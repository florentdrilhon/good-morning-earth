use keyring::Entry;

const SERVICE: &str = "good-morning-earth";

#[tauri::command]
fn save_secret(key: String, value: String) -> Result<(), String> {
    Entry::new(SERVICE, &key)
        .and_then(|e| e.set_password(&value))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_secret(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn launch_spotify() -> Result<(), String> {
    // -g : ne pas mettre Spotify au premier plan
    let status = std::process::Command::new("open")
        .args(["-g", "-a", "Spotify"])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("open -a Spotify a échoué".into()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(tauri::generate_handler![save_secret, load_secret, launch_spotify])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
