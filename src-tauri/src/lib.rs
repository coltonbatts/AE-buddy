use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfig {
    root_dir: String,
    exchange_dir: String,
    context_dir: String,
    out_dir: String,
    logs_dir: String,
    context_path: String,
    generated_plan_path: String,
    generated_script_path: String,
    receipt_path: String,
    execution_result_path: String,
    export_context_script_path: String,
    import_script_path: String,
    model: String,
    open_ai_api_key: String,
}

fn workspace_root() -> PathBuf {
    if let Ok(root) = std::env::var("MOTION_BUDDY_WORKSPACE") {
        return PathBuf::from(root);
    }

    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live under the Motion Buddy workspace")
        .to_path_buf()
}

fn stringify(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
}

#[tauri::command]
fn get_runtime_config() -> RuntimeConfig {
    let root_dir = workspace_root();
    let exchange_dir = root_dir.join(".motion-buddy");
    let context_dir = exchange_dir.join("context");
    let out_dir = exchange_dir.join("out");
    let logs_dir = exchange_dir.join("logs");

    RuntimeConfig {
        root_dir: stringify(root_dir.clone()),
        exchange_dir: stringify(exchange_dir.clone()),
        context_dir: stringify(context_dir.clone()),
        out_dir: stringify(out_dir.clone()),
        logs_dir: stringify(logs_dir.clone()),
        context_path: stringify(context_dir.join("ae-context.json")),
        generated_plan_path: stringify(out_dir.join("generated-plan.json")),
        generated_script_path: stringify(out_dir.join("generated-script.jsx")),
        receipt_path: stringify(out_dir.join("receipt.json")),
        execution_result_path: stringify(out_dir.join("execution-result.json")),
        export_context_script_path: stringify(root_dir.join("after-effects").join("export-context.jsx")),
        import_script_path: stringify(root_dir.join("after-effects").join("import-generated-script.jsx")),
        model: std::env::var("MOTION_BUDDY_MODEL").unwrap_or_else(|_| "gpt-4.1-mini".to_string()),
        open_ai_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_runtime_config])
        .run(tauri::generate_context!())
        .expect("error while running Motion Buddy Studio");
}
