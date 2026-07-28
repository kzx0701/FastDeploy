mod abort;
mod build_artifact;
mod deploy;
mod execution;
mod external;
mod project;
mod project_detection;
mod utils;

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            deploy::check_server_connection,
            deploy::run_local_deploy,
            execution::run_local_build,
            execution::abort_build,
            external::open_external_url,
            external::write_json_file,
            external::read_json_file,
            project::scan_project,
            project::scan_project_ai_context,
            show_main_window,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                let main_window = app.get_webview_window("main").expect("main window not found");
                use tauri::TitleBarStyle;
                main_window.set_title_bar_style(TitleBarStyle::Overlay).expect("failed to set title bar style");

                // 主窗口关闭时隐藏而非退出应用（保留状态栏）
                let main_window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // 阻止默认关闭行为，改为隐藏窗口
                        api.prevent_close();
                        let _ = main_window_clone.hide();
                    }
                });

                // popup 窗口失焦自动隐藏 + 原生毛玻璃材质
                if let Some(popup) = app.get_webview_window("tray-popup") {
                    // 应用原生 NSVisualEffectView 毛玻璃材质 + 圆角
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                    let _ = apply_vibrancy(
                        &popup,
                        NSVisualEffectMaterial::Popover,
                        None,
                        Some(14.0),
                    );

                    let popup_clone = popup.clone();
                    popup.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(false) = event {
                            let _ = popup_clone.hide();
                        }
                    });
                }

                // 创建状态栏图标
                use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
                use tauri::menu::{MenuBuilder, MenuItemBuilder};

                let show_item = MenuItemBuilder::with_id("show_main", "打开 FastDeploy").build(app)?;
                let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
                let menu = MenuBuilder::new(app)
                    .items(&[&show_item, &quit_item])
                    .build()?;

                TrayIconBuilder::new()
                    .icon(tauri::include_image!("icons/tray-icon.png"))
                    .icon_as_template(true)
                    .tooltip("FastDeploy")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        match event.id().as_ref() {
                            "show_main" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            "quit" => { app.exit(0); }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            rect,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(popup) = app.get_webview_window("tray-popup") {
                                // 如果已显示则隐藏，否则显示
                                match popup.is_visible() {
                                    Ok(true) => {
                                        let _ = popup.hide();
                                    }
                                    _ => {
                                        // 计算 popup 窗口位置：图标下方，右对齐
                                        // 统一转换为物理坐标，避免 Retina 屏上逻辑/物理坐标混用导致偏移
                                        let scale_factor = popup.scale_factor().unwrap_or(1.0);
                                        let (icon_x, icon_y) = match &rect.position {
                                            tauri::Position::Physical(pos) => (pos.x as f64, pos.y as f64),
                                            tauri::Position::Logical(pos) => (pos.x * scale_factor, pos.y * scale_factor),
                                        };
                                        let (icon_w, icon_h) = match &rect.size {
                                            tauri::Size::Physical(size) => (size.width as f64, size.height as f64),
                                            tauri::Size::Logical(size) => (size.width * scale_factor, size.height * scale_factor),
                                        };
                                        let popup_width_phys = 320.0 * scale_factor;
                                        let x = icon_x + icon_w - popup_width_phys;
                                        let y = icon_y + icon_h + 4.0 * scale_factor;
                                        let _ = popup.set_position(tauri::Position::Physical(
                                            tauri::PhysicalPosition::new(x as i32, y as i32)
                                        ));
                                        let _ = popup.show();
                                        let _ = popup.set_focus();
                                    }
                                }
                            }
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
