use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;

use crate::project_detection::{detect_project, detect_monorepo_packages, MonorepoPackage};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScanResult {
    name: String,
    local_path: String,
    package_json_path: String,
    project_type: String,
    package_manager: String,
    scripts: HashMap<String, String>,
    detected_build_command: String,
    detected_output_dir: String,
    default_build_command: String,
    default_output_dir: String,
    is_monorepo: bool,
    monorepo_packages: Vec<MonorepoPackage>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAiContextFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAiContextResult {
    project_path: String,
    package_json: String,
    files: Vec<ProjectAiContextFile>,
}

#[tauri::command]
pub fn scan_project(project_path: String) -> Result<ProjectScanResult, String> {
    let project_path = Path::new(&project_path);

    if !project_path.exists() {
        return Err("项目路径不存在".into());
    }

    if !project_path.is_dir() {
        return Err("项目路径不是目录".into());
    }

    let package_json_path = project_path.join("package.json");

    if !package_json_path.exists() {
        return Err("未找到 package.json".into());
    }

    let content = std::fs::read_to_string(&package_json_path)
        .map_err(|error| format!("读取 package.json 失败: {error}"))?;
    let package_json: Value =
        serde_json::from_str(&content).map_err(|error| format!("解析 package.json 失败: {error}"))?;

    let name = project_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown-project".to_string());

    let scripts = package_json
        .get("scripts")
        .and_then(Value::as_object)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|(key, value)| value.as_str().map(|command| (key.clone(), command.to_string())))
                .collect::<HashMap<String, String>>()
        })
        .unwrap_or_default();

    let detection = detect_project(project_path, &package_json, &scripts);
    let monorepo_packages = detect_monorepo_packages(project_path, &package_json);
    let is_monorepo = !monorepo_packages.is_empty();

    Ok(ProjectScanResult {
        name,
        local_path: project_path.to_string_lossy().to_string(),
        package_json_path: package_json_path.to_string_lossy().to_string(),
        project_type: detection.project_type,
        package_manager: detection.package_manager,
        scripts,
        detected_build_command: detection.build_command.clone(),
        detected_output_dir: detection.output_dir.clone(),
        default_build_command: detection.build_command,
        default_output_dir: detection.output_dir,
        is_monorepo,
        monorepo_packages,
    })
}

#[tauri::command]
pub fn scan_project_ai_context(project_path: String) -> Result<ProjectAiContextResult, String> {
    let project_path = Path::new(&project_path);

    if !project_path.exists() {
        return Err("项目路径不存在".into());
    }

    if !project_path.is_dir() {
        return Err("项目路径不是目录".into());
    }

    let package_json_path = project_path.join("package.json");

    if !package_json_path.exists() {
        return Err("未找到 package.json".into());
    }

    let package_json = std::fs::read_to_string(&package_json_path)
        .map_err(|error| format!("读取 package.json 失败: {error}"))?;

    let candidate_files = [
        "vite.config.ts",
        "vite.config.js",
        "vite.config.mts",
        "vite.config.mjs",
        "vite.config.cts",
        "vite.config.cjs",
        "vue.config.js",
        "webpack.config.js",
        "webpack.config.ts",
    ];

    let files = candidate_files
        .iter()
        .filter_map(|relative_path| {
            let file_path = project_path.join(relative_path);

            if !file_path.exists() || !file_path.is_file() {
                return None;
            }

            match std::fs::read_to_string(&file_path) {
                Ok(content) => Some(ProjectAiContextFile {
                    path: (*relative_path).to_string(),
                    content,
                }),
                Err(_) => None,
            }
        })
        .collect::<Vec<_>>();

    Ok(ProjectAiContextResult {
        project_path: project_path.to_string_lossy().to_string(),
        package_json,
        files,
    })
}
