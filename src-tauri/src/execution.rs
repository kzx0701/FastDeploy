use serde::{Deserialize, Serialize};
use std::env;
use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use tauri::async_runtime;
use wait_timeout::ChildExt;

use crate::abort::{register_abort_flag, take_abort_flag};
use crate::build_artifact::{resolve_artifact_dir, ArtifactResolution};
use crate::utils::combine_command_output;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBuildRequest {
    project_path: String,
    build_command: String,
    output_dir: String,
    precheck_command: String,
    run_precheck: bool,
    build_timeout: u64,
    #[serde(default)]
    task_id: String,
    #[serde(default)]
    package_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBuildResult {
    build_command: String,
    output_dir: String,
    output_path: String,
    artifact_verified: bool,
    artifact_resolved_by: String,
    artifact_candidates: Vec<String>,
    artifact_message: String,
    precheck_command: String,
    precheck_output: String,
    precheck_ran: bool,
    precheck_success: bool,
    build_output: String,
    success: bool,
    #[serde(default)]
    aborted: bool,
}

#[tauri::command]
pub async fn run_local_build(request: LocalBuildRequest) -> Result<LocalBuildResult, String> {
    async_runtime::spawn_blocking(move || execute_local_build(request))
        .await
        .map_err(|error| format!("打包任务线程执行失败: {error}"))?
}

#[tauri::command]
pub fn abort_build(task_id: String) -> Result<bool, String> {
    if task_id.trim().is_empty() {
        return Err("task_id 不能为空".into());
    }
    Ok(crate::abort::abort_build(&task_id))
}

fn execute_local_build(request: LocalBuildRequest) -> Result<LocalBuildResult, String> {
    let project_root = Path::new(&request.project_path);

    if !project_root.exists() {
        return Err("项目目录不存在，无法执行打包".into());
    }

    if !project_root.is_dir() {
        return Err("项目路径不是目录，无法执行打包".into());
    }

    // monorepo 子包支持：当 package_path 非空时，cd 到子包目录执行打包
    let package_path_trimmed = request.package_path.trim();
    let effective_path: std::path::PathBuf = if package_path_trimmed.is_empty() {
        project_root.to_path_buf()
    } else {
        let joined = project_root.join(package_path_trimmed);
        if !joined.exists() {
            return Err(format!(
                "子包目录不存在: {package_path_trimmed}（完整路径: {}）",
                joined.display()
            ));
        }
        if !joined.is_dir() {
            return Err(format!("子包路径不是目录: {package_path_trimmed}"));
        }
        joined
    };
    let project_path = effective_path.as_path();

    let build_started_at = SystemTime::now();
    let precheck_command = request.precheck_command.trim().to_string();
    let build_command = request.build_command.trim().to_string();
    let output_dir = request.output_dir.trim().to_string();
    let task_id = request.task_id.trim().to_string();

    // 注册全局中止标志：abort_build 命令会设置此标志，run_shell_command 轮询检测
    let has_task_id = !task_id.is_empty();
    let aborted_flag: Arc<AtomicBool> = if has_task_id {
        register_abort_flag(&task_id)
    } else {
        Arc::new(AtomicBool::new(false))
    };

    if build_command.is_empty() {
        if has_task_id {
            let _ = take_abort_flag(&task_id);
        }
        return Err("打包命令不能为空".into());
    }

    let mut precheck_output = String::new();
    let mut precheck_success = true;
    let precheck_ran = request.run_precheck && !precheck_command.is_empty();

    let build_timeout = if request.build_timeout > 0 {
        Duration::from_secs(request.build_timeout)
    } else {
        Duration::from_secs(600)
    };

    if precheck_ran {
        let precheck = match run_shell_command(
            project_path,
            &precheck_command,
            Some(build_timeout),
            &aborted_flag,
        ) {
            Ok(result) => result,
            Err(error) => {
                if has_task_id {
                    let _ = take_abort_flag(&task_id);
                }
                return Err(error);
            }
        };
        precheck_success = precheck.status == 0;
        precheck_output = combine_command_output(&precheck.stdout, &precheck.stderr);

        if aborted_flag.load(Ordering::SeqCst) {
            if has_task_id {
                let _ = take_abort_flag(&task_id);
            }
            return Ok(aborted_result(
                build_command,
                output_dir.clone(),
                project_path,
                precheck_command,
                precheck_output,
                precheck_ran,
                precheck_success,
                String::new(),
            ));
        }

        if !precheck_success {
            if has_task_id {
                let _ = take_abort_flag(&task_id);
            }
            return Ok(LocalBuildResult {
                build_command,
                output_dir: output_dir.clone(),
                output_path: project_path.join(&output_dir).to_string_lossy().to_string(),
                artifact_verified: false,
                artifact_resolved_by: "precheck-failed".into(),
                artifact_candidates: Vec::new(),
                artifact_message: "前置校验失败，未执行打包产物解析".into(),
                precheck_command,
                precheck_output,
                precheck_ran,
                precheck_success: false,
                build_output: String::new(),
                success: false,
                aborted: false,
            });
        }
    }

    let build = match run_shell_command(
        project_path,
        &build_command,
        Some(build_timeout),
        &aborted_flag,
    ) {
        Ok(result) => result,
        Err(error) => {
            if has_task_id {
                let _ = take_abort_flag(&task_id);
            }
            return Err(error);
        }
    };

    if aborted_flag.load(Ordering::SeqCst) {
        if has_task_id {
            let _ = take_abort_flag(&task_id);
        }
        let build_output = combine_command_output(&build.stdout, &build.stderr);
        return Ok(aborted_result(
            build_command,
            output_dir.clone(),
            project_path,
            precheck_command,
            precheck_output,
            precheck_ran,
            precheck_success,
            build_output,
        ));
    }

    let mut build_output = combine_command_output(&build.stdout, &build.stderr);

    // pnpm v11+ 安全策略：首次遇到 ERR_PNPM_IGNORED_BUILDS 时自动修复后重试
    let build_status = if build.status != 0 && build_output.contains("ERR_PNPM_IGNORED_BUILDS") {
        // 先用 ignore-scripts=false 安装依赖，绕过构建脚本拦截
        let install = run_shell_command(
            project_path,
            "pnpm install --config.ignore-scripts=false",
            Some(Duration::from_secs(120)),
            &aborted_flag,
        );
        match install {
            Ok(install_result) if install_result.status == 0 => {
                // 依赖安装成功，重试原始 build 命令
                let retry = match run_shell_command(
                    project_path,
                    &build_command,
                    Some(build_timeout),
                    &aborted_flag,
                ) {
                    Ok(result) => result,
                    Err(error) => {
                        if has_task_id {
                            let _ = take_abort_flag(&task_id);
                        }
                        return Err(error);
                    }
                };
                build_output = combine_command_output(&retry.stdout, &retry.stderr);
                retry.status
            }
            _ => {
                // install 也失败，直接返回原始错误
                build_output = format!("[自动修复失败，请手动执行: pnpm approve-builds]\n{}", build_output);
                build.status
            }
        }
    } else {
        build.status
    };

    if aborted_flag.load(Ordering::SeqCst) {
        if has_task_id {
            let _ = take_abort_flag(&task_id);
        }
        return Ok(aborted_result(
            build_command,
            output_dir.clone(),
            project_path,
            precheck_command,
            precheck_output,
            precheck_ran,
            precheck_success,
            build_output,
        ));
    }

    if has_task_id {
        let _ = take_abort_flag(&task_id);
    }

    let artifact = if build_status == 0 {
        resolve_artifact_dir(project_path, &output_dir, build_started_at)
    } else {
        unresolved_artifact(project_path, &output_dir, "打包失败，未执行产物目录解析")
    };

    Ok(LocalBuildResult {
        build_command,
        output_dir: artifact.output_dir,
        output_path: artifact.output_path,
        artifact_verified: artifact.verified,
        artifact_resolved_by: artifact.resolved_by,
        artifact_candidates: artifact.candidates,
        artifact_message: artifact.message,
        precheck_command,
        precheck_output,
        precheck_ran,
        precheck_success,
        build_output,
        success: build_status == 0,
        aborted: false,
    })
}

#[allow(clippy::too_many_arguments)]
fn aborted_result(
    build_command: String,
    output_dir: String,
    project_path: &Path,
    precheck_command: String,
    precheck_output: String,
    precheck_ran: bool,
    precheck_success: bool,
    build_output: String,
) -> LocalBuildResult {
    LocalBuildResult {
        build_command,
        output_dir: output_dir.clone(),
        output_path: project_path.join(&output_dir).to_string_lossy().to_string(),
        artifact_verified: false,
        artifact_resolved_by: "aborted".into(),
        artifact_candidates: Vec::new(),
        artifact_message: "打包任务已中止".into(),
        precheck_command,
        precheck_output,
        precheck_ran,
        precheck_success,
        build_output,
        success: false,
        aborted: true,
    }
}

fn unresolved_artifact(project_path: &Path, output_dir: &str, message: &str) -> ArtifactResolution {
    ArtifactResolution {
        output_dir: output_dir.to_string(),
        output_path: project_path.join(output_dir).to_string_lossy().to_string(),
        verified: false,
        resolved_by: "configured".into(),
        candidates: Vec::new(),
        message: message.into(),
    }
}

struct CommandOutput {
    status: i32,
    stderr: String,
    stdout: String,
}

/// 构造扩展后的 PATH，覆盖常见 node/pnpm 安装路径。
///
/// macOS GUI 应用从 Finder/Spotlight 启动时，进程 PATH 仅含 /usr/bin:/bin 等系统路径，
/// 不包含 nvm/fnm/homebrew/volta 安装的 node/pnpm。
/// 登录 shell（-l）只读 ~/.zprofile，而 nvm/fnm 的 PATH 通常写在 ~/.zshrc 中，导致找不到命令。
/// 此函数主动收集常见安装路径，不依赖 shell 配置文件加载顺序。
#[cfg(not(target_os = "windows"))]
fn build_extended_unix_path() -> String {
    let home = env::var("HOME").unwrap_or_default();
    let current_path = env::var("PATH").unwrap_or_default();

    let mut paths: Vec<String> = vec![current_path];

    // Homebrew（Apple Silicon & Intel）
    paths.push("/opt/homebrew/bin".to_string());
    paths.push("/opt/homebrew/sbin".to_string());
    paths.push("/usr/local/bin".to_string());
    paths.push("/usr/local/sbin".to_string());

    if !home.is_empty() {
        // Volta
        paths.push(format!("{home}/.volta/bin"));
        // pnpm 全局安装
        paths.push(format!("{home}/.local/share/pnpm"));
        // fnm
        paths.push(format!("{home}/.fnm/aliases/default/bin"));
        paths.push(format!("{home}/.local/share/fnm/aliases/default/bin"));
        // Cargo（rust 工具链）
        paths.push(format!("{home}/.cargo/bin"));

        // nvm：扫描已安装版本，最新的优先
        let nvm_versions_dir = format!("{home}/.nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(&nvm_versions_dir) {
            let mut versions: Vec<String> = entries
                .filter_map(|e| e.ok())
                .filter_map(|e| {
                    let bin = e.path().join("bin");
                    bin.to_str().map(|s| s.to_string())
                })
                .collect();
            // 按版本号倒序（v20 > v18），最新的在前
            versions.sort();
            versions.reverse();
            paths.extend(versions);
        }

        // asdf
        paths.push(format!("{home}/.asdf/shims"));
        // mise (原 rtx)
        paths.push(format!("{home}/.local/share/mise/shims"));
    }

    paths.join(":")
}

/// 执行 shell 命令，支持轮询中止标志
/// 当 aborted_flag 被设为 true 时，立即 kill 整个进程组并返回 status=130 的 CommandOutput
fn run_shell_command(
    project_path: &Path,
    command: &str,
    timeout: Option<Duration>,
    aborted_flag: &Arc<AtomicBool>,
) -> Result<CommandOutput, String> {
    #[cfg(target_os = "windows")]
    let mut shell_command = {
        let mut shell_command = Command::new("cmd");
        shell_command.args(["/C", command]);
        shell_command
    };

    #[cfg(not(target_os = "windows"))]
    let mut shell_command = {
        use std::os::unix::process::CommandExt;

        let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut shell_command = Command::new(shell);
        // 使用 -lc（登录 shell + 命令），不使用 -i（交互式）避免 prompt/termios 副作用
        shell_command.args(["-lc", command]);

        // macOS GUI 应用启动时 PATH 仅含 /usr/bin:/bin 等系统路径，
        // nvm/fnm/homebrew/volta 安装的 pnpm/node 找不到。
        // 主动扩展 PATH 覆盖常见安装位置，不依赖 ~/.zshrc 加载。
        shell_command.env("PATH", build_extended_unix_path());

        // 创建新会话（新进程组），使后续 killpg 能杀掉整个进程树（shell → pnpm → node）
        unsafe {
            shell_command.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }

        shell_command
    };

    let mut child = shell_command
        .current_dir(project_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|error| format!("执行命令失败: {error}"))?;

    // 关键修复：用独立线程异步读取 stdout/stderr，避免管道缓冲区（64KB）填满后死锁。
    // 之前的实现只在子进程退出后才读输出，vite build 输出量大时会死锁。
    let stdout_handle = child.stdout.take();
    let stderr_handle = child.stderr.take();

    let stdout_thread = std::thread::spawn(move || {
        let mut buf = String::new();
        if let Some(mut handle) = stdout_handle {
            use std::io::Read;
            let _ = handle.read_to_string(&mut buf);
        }
        buf
    });

    let stderr_thread = std::thread::spawn(move || {
        let mut buf = String::new();
        if let Some(mut handle) = stderr_handle {
            use std::io::Read;
            let _ = handle.read_to_string(&mut buf);
        }
        buf
    });

    let timeout_duration = timeout.unwrap_or(Duration::from_secs(600));
    let poll_interval = Duration::from_millis(200);
    let deadline = Instant::now() + timeout_duration;

    // 轮询等待：每 200ms 检查一次是否超时或被中止
    loop {
        // 先检查中止标志
        if aborted_flag.load(Ordering::SeqCst) {
            kill_process_group(&mut child);
            // killpg 后所有子进程退出，管道写端关闭，读取线程会收到 EOF 并退出
            let stdout = stdout_thread.join().unwrap_or_default();
            let stderr = stderr_thread.join().unwrap_or_default();
            return Ok(CommandOutput {
                status: 130,
                stdout,
                stderr,
            });
        }

        match child.wait_timeout(poll_interval) {
            Ok(Some(status)) => {
                let code = status.code().unwrap_or(-1);
                // 子进程已退出，等待读取线程收尾（管道已关闭，线程会很快返回）
                let stdout = stdout_thread.join().unwrap_or_default();
                let stderr = stderr_thread.join().unwrap_or_default();
                return Ok(CommandOutput {
                    status: code,
                    stdout,
                    stderr,
                });
            }
            Ok(None) => {
                // 仍在运行，检查是否超时
                if Instant::now() >= deadline {
                    kill_process_group(&mut child);
                    let stdout = stdout_thread.join().unwrap_or_default();
                    let stderr = stderr_thread.join().unwrap_or_default();
                    let partial_output = combine_command_output(&stdout, &stderr);
                    return Err(format!(
                        "命令执行超时（{} 秒），已自动终止。部分输出:\n{}",
                        timeout_duration.as_secs(),
                        partial_output
                    ));
                }
                // 继续轮询
            }
            Err(error) => {
                // 等待出错也要清理子进程和读取线程
                kill_process_group(&mut child);
                let _ = stdout_thread.join();
                let _ = stderr_thread.join();
                return Err(format!("等待命令完成失败: {error}"));
            }
        }
    }
}

/// kill 整个进程组（Unix）或单个进程（Windows）
fn kill_process_group(child: &mut std::process::Child) {
    #[cfg(not(target_os = "windows"))]
    {
        // setsid 后子进程 PID == 进程组 PGID，killpg(PID, SIGKILL) 杀整个组
        let pid = child.id() as i32;
        unsafe {
            libc::killpg(pid, libc::SIGKILL);
        }
    }
    #[cfg(target_os = "windows")]
    {
        let _ = child.kill();
    }
    // 确保 child 资源被回收（非阻塞）
    let _ = child.try_wait();
}
