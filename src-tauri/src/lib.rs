use serde::Serialize;
use serde_json::{json, Value};
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
    open_ai_enabled: bool,
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

fn extract_json_object(raw: &str) -> Result<&str, String> {
    let trimmed = raw.trim();
    let start = trimmed
        .find('{')
        .ok_or_else(|| "Model response did not contain a JSON object.".to_string())?;
    let end = trimmed
        .rfind('}')
        .ok_or_else(|| "Model response did not contain a JSON object.".to_string())?;

    if end <= start {
        return Err("Model response did not contain a valid JSON object.".to_string());
    }

    Ok(&trimmed[start..=end])
}

fn openai_error_message(body: &Value) -> String {
    body.get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("OpenAI request failed.")
        .to_string()
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
        open_ai_enabled: std::env::var("OPENAI_API_KEY")
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
    }
}

#[tauri::command]
async fn generate_openai_plan(
    model: String,
    #[allow(non_snake_case)] systemPrompt: String,
    prompt: String,
    context: Value,
) -> Result<Value, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY is not configured for Motion Buddy Studio.".to_string())?;

    let response = reqwest::Client::new()
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "temperature": 0.1,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": systemPrompt },
                {
                    "role": "user",
                    "content": format!(
                        "User request:\n{}\n\nAfter Effects context JSON:\n{}",
                        prompt,
                        serde_json::to_string_pretty(&context)
                            .map_err(|error| format!("Failed to serialize AE context: {error}"))?
                    )
                }
            ]
        }))
        .send()
        .await
        .map_err(|error| format!("Failed to call OpenAI: {error}"))?;

    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .map_err(|error| format!("Failed to decode the OpenAI response: {error}"))?;

    if !status.is_success() {
        return Err(openai_error_message(&body));
    }

    let raw = body
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .ok_or_else(|| "OpenAI returned an empty response.".to_string())?;

    let json_object = extract_json_object(raw)?;
    serde_json::from_str(json_object)
        .map_err(|error| format!("OpenAI returned invalid JSON: {error}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_runtime_config, generate_openai_plan])
        .run(tauri::generate_context!())
        .expect("error while running Motion Buddy Studio");
}
