use wasm_bindgen::prelude::*;
use quick_xml::events::Event;
use quick_xml::Reader;
use serde_json::{json, Value};
use serde_wasm_bindgen::to_value as to_js_value;

#[wasm_bindgen]
pub fn parse(xml: &str) -> JsValue {
    // Very small mapper that extracts a subset needed for benchmarking shape compatibility
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    // Build xml2js-like shape: { vmix: { key: [ ... ] } }
    let mut vmix = serde_json::Map::new();

    // Pre-initialize common scalars as arrays like xml2js would do
    // We'll fill these when encountered
    let mut buf: Vec<u8> = Vec::with_capacity(1024);
    let mut current_path: Vec<String> = Vec::with_capacity(8);

    // Simple collectors
    let mut inputs: Vec<Value> = Vec::with_capacity(32);
    let mut overlays: Vec<Value> = Vec::with_capacity(8);
    let mut transitions: Vec<Value> = Vec::with_capacity(8);
    let mut audio_entries: Vec<(String, Value)> = Vec::with_capacity(10);
    let mut version: Option<String> = None;
    let mut edition: Option<String> = None;
    let mut preset: Option<String> = None;
    let mut active: Option<String> = None;
    let mut preview: Option<String> = None;
    let mut streaming: Option<String> = None;
    let mut fade_to_black: Option<String> = None;
    let mut external: Option<String> = None;
    let mut play_list: Option<String> = None;
    let mut multicorder: Option<String> = None;
    let mut fullscreen: Option<String> = None;
    let mut recording_duration: Option<String> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_path.push(name.clone());

                match name.as_str() {
                    // Collect inputs as xml2js-like: inputs[0].input = [ { $: { ... } } ]
                    "input" => {
                        let mut attrs = serde_json::Map::new();
                        for a in e.attributes().flatten() {
                            let k = String::from_utf8_lossy(a.key.as_ref()).to_string();
                            let v = String::from_utf8_lossy(&a.value).to_string();
                            attrs.insert(k, Value::String(v));
                        }
                        inputs.push(json!({"$": attrs}));
                    }
                    "overlay" => {
                        let mut o = serde_json::Map::new();
                        if let Some(n) = e
                            .attributes()
                            .flatten()
                            .find(|a| a.key.as_ref() == b"number")
                        {
                            o.insert("$".to_string(), json!({"number": String::from_utf8_lossy(&n.value).to_string()}));
                        }
                        overlays.push(Value::Object(o));
                    }
                    "transition" => {
                        let mut attrs = serde_json::Map::new();
                        for a in e.attributes().flatten() {
                            let k = String::from_utf8_lossy(a.key.as_ref()).to_string();
                            let v = String::from_utf8_lossy(&a.value).to_string();
                            attrs.insert(k, Value::String(v));
                        }
                        transitions.push(json!({"$": attrs}));
                    }
                    "recording" => {
                        if let Some(d) = e
                            .attributes()
                            .flatten()
                            .find(|a| a.key.as_ref() == b"duration")
                        {
                            recording_duration = Some(String::from_utf8_lossy(&d.value).to_string());
                        }
                    }
                    // audio buses: <audio><master ... /></audio>
                    n if n == "master" || n.starts_with("bus") => {
                        let mut attrs = serde_json::Map::new();
                        for a in e.attributes().flatten() {
                            let k = String::from_utf8_lossy(a.key.as_ref()).to_string();
                            let v = String::from_utf8_lossy(&a.value).to_string();
                            attrs.insert(k, Value::String(v));
                        }
                        audio_entries.push((name.clone(), json!({"$": attrs})));
                    }
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if let Some(last) = current_path.pop() {
                    if last != name {
                        // ignore
                    }
                }
            }
            Ok(Event::Text(t)) => {
                let text = t.unescape().unwrap_or_default().to_string();
                if let Some(last) = current_path.last() {
                    match last.as_str() {
                        "version" => version = Some(text),
                        "edition" => edition = Some(text),
                        "preset" => preset = Some(text),
                        "active" => active = Some(text),
                        "preview" => preview = Some(text),
                        "streaming" => streaming = Some(text),
                        "fadeToBlack" => fade_to_black = Some(text),
                        "external" => external = Some(text),
                        "playList" => play_list = Some(text),
                        "multiCorder" => multicorder = Some(text),
                        "fullscreen" => fullscreen = Some(text),
                        _ => {}
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    // Assemble xml2js-like JSON
    if let Some(v) = version { vmix.insert("version".to_string(), json!([v])); }
    if let Some(v) = edition { vmix.insert("edition".to_string(), json!([v])); }
    if let Some(v) = preset { vmix.insert("preset".to_string(), json!([v])); }
    if let Some(v) = active { vmix.insert("active".to_string(), json!([v])); }
    if let Some(v) = preview { vmix.insert("preview".to_string(), json!([v])); }
    if let Some(v) = streaming { vmix.insert("streaming".to_string(), json!([v])); }
    if let Some(v) = fade_to_black { vmix.insert("fadeToBlack".to_string(), json!([v])); }
    if let Some(v) = external { vmix.insert("external".to_string(), json!([v])); }
    if let Some(v) = play_list { vmix.insert("playList".to_string(), json!([v])); }
    if let Some(v) = multicorder { vmix.insert("multiCorder".to_string(), json!([v])); }
    if let Some(v) = fullscreen { vmix.insert("fullscreen".to_string(), json!([v])); }

    if !inputs.is_empty() {
        vmix.insert("inputs".to_string(), json!([{ "input": inputs }]));
    }
    if !overlays.is_empty() {
        vmix.insert("overlays".to_string(), json!([{ "overlay": overlays }]));
    }
    if !transitions.is_empty() {
        vmix.insert("transitions".to_string(), json!([{ "transition": transitions }]));
    }
    if !audio_entries.is_empty() {
        let mut audio_obj = serde_json::Map::new();
        for (name, v) in audio_entries {
            audio_obj.insert(name, v);
        }
        vmix.insert("audio".to_string(), json!([Value::Object(audio_obj)]));
    }
    if let Some(d) = recording_duration { vmix.insert("recording".to_string(), json!([{"$": {"duration": d}}])); }

    let obj = json!({ "vmix": Value::Object(vmix) });
    to_js_value(&obj).unwrap_or(JsValue::NULL)
}


