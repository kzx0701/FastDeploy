use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

/// 全局打包中止标志表
/// key: task_id, value: 中止标志（abort_build 命令设为 true，run_shell_command 轮询检测）
static ABORT_FLAGS: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 为指定 task_id 注册中止标志，返回标志的 Arc 副本供本函数轮询
pub fn register_abort_flag(task_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = ABORT_FLAGS.lock() {
        map.insert(task_id.to_string(), flag.clone());
    }
    flag
}

/// 移除并返回指定 task_id 的中止标志（正常结束时调用，清理资源）
pub fn take_abort_flag(task_id: &str) -> Option<Arc<AtomicBool>> {
    if let Ok(mut map) = ABORT_FLAGS.lock() {
        map.remove(task_id)
    } else {
        None
    }
}

/// 中止指定 task_id 的打包任务
/// 返回 true 表示成功设置中止标志，false 表示任务不存在（可能已结束）
pub fn abort_build(task_id: &str) -> bool {
    if let Ok(map) = ABORT_FLAGS.lock() {
        if let Some(flag) = map.get(task_id) {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
            return true;
        }
    }
    false
}
