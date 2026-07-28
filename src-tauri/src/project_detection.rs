use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct ProjectDetection {
    pub project_type: String,
    pub package_manager: String,
    pub build_command: String,
    pub output_dir: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonorepoPackage {
    pub name: String,
    pub relative_path: String,
    pub project_type: String,
    pub build_command: String,
    pub output_dir: String,
}

pub fn detect_project(project_path: &Path, package_json: &Value, scripts: &HashMap<String, String>) -> ProjectDetection {
    let dependencies = extract_dependency_names(package_json);
    let project_type = detect_project_type(project_path, &dependencies, scripts);
    let package_manager = detect_package_manager(project_path);
    let build_command = detect_build_command(scripts, &package_manager);
    let output_dir = detect_output_dir(project_path, &project_type);

    ProjectDetection {
        project_type,
        package_manager,
        build_command,
        output_dir,
    }
}

pub fn extract_dependency_names(package_json: &Value) -> Vec<String> {
    ["dependencies", "devDependencies"]
        .iter()
        .filter_map(|key| package_json.get(key).and_then(Value::as_object))
        .flat_map(|deps| deps.keys().cloned())
        .collect()
}

pub fn detect_project_type(project_path: &Path, dependencies: &[String], scripts: &HashMap<String, String>) -> String {
    let has_vite_config = vite_config_path(project_path).is_some();
    let has_vue = dependencies.iter().any(|dep| dep == "vue");
    let has_react = dependencies.iter().any(|dep| dep == "react");
    let has_vue_cli = dependencies.iter().any(|dep| dep == "@vue/cli-service");
    let has_react_scripts = dependencies.iter().any(|dep| dep == "react-scripts");
    let has_next = dependencies.iter().any(|dep| dep == "next");
    let has_nuxt = dependencies.iter().any(|dep| dep == "nuxt" || dep == "nuxi");
    let has_astro = dependencies.iter().any(|dep| dep == "astro");
    let has_sveltekit = dependencies.iter().any(|dep| dep == "@sveltejs/kit");

    if has_next {
        return "next".into();
    }

    if has_nuxt {
        return "nuxt".into();
    }

    if has_astro {
        return "astro".into();
    }

    if has_sveltekit {
        return "sveltekit".into();
    }

    if has_vite_config && has_vue {
        return "vite-vue".into();
    }

    if has_vite_config && has_react {
        return "vite-react".into();
    }

    if has_vue_cli {
        return "vue-cli".into();
    }

    if has_react_scripts {
        return "react".into();
    }

    if scripts.contains_key("generate") {
        return "static-generator".into();
    }

    "unknown".into()
}

pub fn detect_package_manager(project_path: &Path) -> String {
    if project_path.join("pnpm-lock.yaml").exists() {
        return "pnpm".into();
    }

    if project_path.join("yarn.lock").exists() {
        return "yarn".into();
    }

    if project_path.join("package-lock.json").exists() {
        return "npm".into();
    }

    "unknown".into()
}

pub fn detect_output_dir(project_path: &Path, project_type: &str) -> String {
    if let Some(output_dir) = detect_config_output_dir(project_path) {
        return output_dir;
    }

    match project_type {
        "react" => "build".into(),
        "next" => ".next".into(),
        "nuxt" => ".output/public".into(),
        "sveltekit" => "build".into(),
        _ => "dist".into(),
    }
}

pub fn detect_build_command(scripts: &HashMap<String, String>, package_manager: &str) -> String {
    if let Some(script_name) = choose_build_script(scripts) {
        return package_script_command(package_manager, &script_name);
    }

    String::new()
}

fn choose_build_script(scripts: &HashMap<String, String>) -> Option<String> {
    let preferred = [
        "build:prod",
        "build:production",
        "build:release",
        "build:preview",
        "build",
        "generate",
        "export",
    ];

    for script_name in preferred {
        if scripts.contains_key(script_name) {
            return Some(script_name.to_string());
        }
    }

    let mut build_variants = scripts
        .keys()
        .filter(|name| name.starts_with("build:"))
        .filter(|name| !is_non_deploy_build_script(name))
        .cloned()
        .collect::<Vec<_>>();
    build_variants.sort_by_key(|name| build_script_rank(name));

    build_variants.first().cloned()
}

fn build_script_rank(script_name: &str) -> usize {
    let lower = script_name.to_lowercase();

    if lower.contains("prod") || lower.contains("production") {
        return 0;
    }

    if lower.contains("release") {
        return 1;
    }

    if lower.contains("stage") || lower.contains("staging") {
        return 2;
    }

    if lower.contains("preview") {
        return 3;
    }

    10
}

fn is_non_deploy_build_script(script_name: &str) -> bool {
    let lower = script_name.to_lowercase();

    ["dev", "test", "watch", "type", "types", "lib", "storybook"]
        .iter()
        .any(|keyword| lower.contains(keyword))
}

fn package_script_command(package_manager: &str, script_name: &str) -> String {
    match (package_manager, script_name) {
        ("pnpm", "build") => "pnpm build".into(),
        ("pnpm", _) => format!("pnpm {script_name}"),
        ("yarn", "build") => "yarn build".into(),
        ("yarn", _) => format!("yarn {script_name}"),
        (_, _) => format!("npm run {script_name}"),
    }
}

fn detect_config_output_dir(project_path: &Path) -> Option<String> {
    vite_config_path(project_path)
        .and_then(|path| read_output_dir_from_config(&path, "outDir"))
        .or_else(|| read_output_dir_from_config(&project_path.join("vue.config.js"), "outputDir"))
        .or_else(|| read_output_dir_from_config(&project_path.join("webpack.config.js"), "path"))
        .or_else(|| read_output_dir_from_config(&project_path.join("webpack.config.ts"), "path"))
}

fn vite_config_path(project_path: &Path) -> Option<PathBuf> {
    ["ts", "js", "mts", "mjs", "cts", "cjs"]
        .iter()
        .map(|ext| project_path.join(format!("vite.config.{ext}")))
        .find(|path| path.exists() && path.is_file())
}

fn read_output_dir_from_config(config_path: &Path, key: &str) -> Option<String> {
    let content = std::fs::read_to_string(config_path).ok()?;
    let key_position = content.find(key)?;
    let after_key = &content[key_position + key.len()..];
    let value_start = after_key.find(['"', '\'', '`'])?;
    let quote = after_key.as_bytes().get(value_start).copied()? as char;
    let value_body = &after_key[value_start + quote.len_utf8()..];
    let value_end = value_body.find(quote)?;
    let raw_value = value_body[..value_end].trim();

    normalize_config_output_value(raw_value)
}

fn normalize_config_output_value(raw_value: &str) -> Option<String> {
    let value = raw_value
        .trim()
        .trim_start_matches("./")
        .trim_start_matches("public/")
        .trim()
        .replace('\\', "/");

    if value.is_empty() || value.contains("${") || value.starts_with('/') {
        return None;
    }

    Some(value)
}

// ==================== Monorepo 检测 ====================

/// 检测项目是否为 monorepo，如果是则返回所有**可部署**的子包信息。
/// 只返回有 index.html 或检测到前端框架的子包（过滤掉 internal/packages 下的库包）。
/// 识别信号：pnpm-workspace.yaml、package.json 的 workspaces 字段。
pub fn detect_monorepo_packages(project_path: &Path, package_json: &Value) -> Vec<MonorepoPackage> {
    let workspace_globs = collect_workspace_globs(project_path, package_json);
    if workspace_globs.is_empty() {
        return Vec::new();
    }

    let package_manager = detect_package_manager(project_path);
    let mut packages = Vec::new();

    for glob in workspace_globs {
        for package_dir in expand_workspace_glob(project_path, &glob) {
            if let Some(pkg) = read_monorepo_package(project_path, &package_dir, &package_manager) {
                // 只保留可部署的前端应用（有 index.html 或检测到前端框架）
                if !is_deployable_package(&package_dir, &pkg.project_type) {
                    continue;
                }
                // 去重：同一个 relative_path 只保留一次
            if !packages.iter().any(|p: &MonorepoPackage| p.relative_path == pkg.relative_path) {
                packages.push(pkg);
            }
            }
        }
    }

    // 按路径排序，保证展示稳定
    packages.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    packages
}

/// 判断子包是否是可部署的前端应用
fn is_deployable_package(package_dir: &Path, project_type: &str) -> bool {
    // 有 index.html 的是前端应用
    if package_dir.join("index.html").is_file() {
        return true;
    }
    // 检测到前端框架的也是可部署应用
    project_type != "unknown"
}

/// 从 pnpm-workspace.yaml 和 package.json workspaces 字段收集工作区 glob 模式
fn collect_workspace_globs(project_path: &Path, package_json: &Value) -> Vec<String> {
    let mut globs = Vec::new();

    // 1. pnpm-workspace.yaml
    let workspace_yaml = project_path.join("pnpm-workspace.yaml");
    if workspace_yaml.exists() {
        if let Ok(content) = std::fs::read_to_string(&workspace_yaml) {
            globs.extend(parse_pnpm_workspace_yaml(&content));
        }
    }

    // 2. package.json workspaces 字段
    if let Some(workspaces) = package_json.get("workspaces") {
        match workspaces {
            Value::Array(arr) => {
                for item in arr {
                    if let Some(s) = item.as_str() {
                        globs.push(s.to_string());
                    }
                }
            }
            Value::Object(obj) => {
                if let Some(packages) = obj.get("packages").and_then(Value::as_array) {
                    for item in packages {
                        if let Some(s) = item.as_str() {
                            globs.push(s.to_string());
                        }
                    }
                }
            }
            _ => {}
        }
    }

    globs
}

/// 简单解析 pnpm-workspace.yaml，提取 packages 列表中的 glob 模式
fn parse_pnpm_workspace_yaml(content: &str) -> Vec<String> {
    let mut globs = Vec::new();
    let mut in_packages = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // 空行跳过
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // 顶层 key（无缩进）
        if !line.starts_with(' ') && !line.starts_with('\t') {
            in_packages = trimmed == "packages:";
            continue;
        }

        // 在 packages: 下方的列表项
        if in_packages {
            if let Some(stripped) = trimmed.strip_prefix("- ") {
                let pattern = stripped.trim().trim_matches(|c| c == '\'' || c == '"');
                if !pattern.is_empty() {
                    globs.push(pattern.to_string());
                }
            }
        }
    }

    globs
}

/// 展开 workspace glob（如 "apps/*"、"packages/*"）为实际目录列表
fn expand_workspace_glob(project_path: &Path, glob: &str) -> Vec<PathBuf> {
    let glob = glob.trim().trim_start_matches("./");

    // 支持 path/to/glob 形式
    let parts: Vec<&str> = glob.split('/').collect();

    // 找到第一个包含通配符的部分
    let wildcard_idx = parts.iter().position(|p| p.contains('*') || p.contains('?'));

    match wildcard_idx {
        None => {
            // 无通配符，直接检查是否存在
            let path = project_path.join(glob);
            if path.is_dir() {
                vec![path]
            } else {
                Vec::new()
            }
        }
        Some(idx) => {
            // 前缀部分（通配符之前）
            let prefix: PathBuf = parts[..idx].iter().collect();
            let base = project_path.join(&prefix);
            let pattern = parts[idx];
            let suffix: Vec<&str> = parts[idx + 1..].to_vec();

            if !base.is_dir() {
                return Vec::new();
            }

            let entries = match std::fs::read_dir(&base) {
                Ok(e) => e.filter_map(Result::ok).collect::<Vec<_>>(),
                Err(_) => return Vec::new(),
            };

            let mut results = Vec::new();
            for entry in entries {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n,
                    None => continue,
                };

                // 简单通配符匹配：只支持 * (匹配除 / 外的任意字符)
                if simple_glob_match(pattern, name) {
                    // 如果还有后续路径部分，拼接上去
                    if suffix.is_empty() {
                        results.push(path);
                    } else {
                        let full = path.join(suffix.join("/"));
                        if full.is_dir() {
                            results.push(full);
                        }
                    }
                }
            }
            results
        }
    }
}

/// 简单 glob 匹配：支持 * (匹配任意非 / 字符) 和 ? (匹配单个字符)
fn simple_glob_match(pattern: &str, text: &str) -> bool {
    let pbytes = pattern.as_bytes();
    let tbytes = text.as_bytes();
    glob_match_helper(pbytes, 0, tbytes, 0)
}

fn glob_match_helper(pattern: &[u8], pidx: usize, text: &[u8], tidx: usize) -> bool {
    let mut pidx = pidx;
    let mut tidx = tidx;

    while pidx < pattern.len() {
        match pattern[pidx] {
            b'*' => {
                // * 匹配 0 个或多个字符
                if pidx + 1 >= pattern.len() {
                    return true; // 末尾的 * 匹配剩余所有
                }
                // 尝试匹配后续 pattern
                for i in tidx..=text.len() {
                    if glob_match_helper(pattern, pidx + 1, text, i) {
                        return true;
                    }
                }
                return false;
            }
            b'?' => {
                if tidx >= text.len() {
                    return false;
                }
                pidx += 1;
                tidx += 1;
            }
            c => {
                if tidx >= text.len() || text[tidx] != c {
                    return false;
                }
                pidx += 1;
                tidx += 1;
            }
        }
    }

    tidx == text.len()
}

/// 读取 monorepo 子包信息
fn read_monorepo_package(
    project_root: &Path,
    package_dir: &Path,
    package_manager: &str,
) -> Option<MonorepoPackage> {
    let package_json_path = package_dir.join("package.json");
    if !package_json_path.is_file() {
        return None;
    }

    let content = std::fs::read_to_string(&package_json_path).ok()?;
    let package_json: Value = serde_json::from_str(&content).ok()?;

    let name = package_json
        .get("name")
        .and_then(Value::as_str)
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            package_dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string()
        });

    let scripts = package_json
        .get("scripts")
        .and_then(Value::as_object)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect::<HashMap<String, String>>()
        })
        .unwrap_or_default();

    let dependencies = extract_dependency_names(&package_json);
    let project_type = detect_project_type(package_dir, &dependencies, &scripts);
    let build_command = detect_build_command(&scripts, package_manager);
    let output_dir = detect_output_dir(package_dir, &project_type);

    let relative_path = package_dir
        .strip_prefix(project_root)
        .ok()
        .and_then(|p| p.to_str())
        .map(|s| s.replace('\\', "/"))
        .unwrap_or_default();

    Some(MonorepoPackage {
        name,
        relative_path,
        project_type,
        build_command,
        output_dir,
    })
}
