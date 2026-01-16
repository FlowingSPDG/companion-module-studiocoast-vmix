use vmix_core::models::Vmix;
use wasm_bindgen::prelude::*;
use js_sys::{Object, Array};
use quick_xml::de::from_str;

// Helper to wrap scalar values in arrays (xml2js format)
fn wrap_in_array(val: &str) -> JsValue {
    let arr = Array::new();
    arr.push(&JsValue::from_str(val));
    arr.into()
}

// Helper to convert input attributes to JS Object
fn input_to_js(input: &vmix_core::models::Input) -> Object {
    let input_obj = Object::new();
    let attrs = Object::new();
    
    // Set all input attributes (fields are not Option in vmix-rs)
    let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("key"), &JsValue::from_str(&input.key));
    let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("number"), &JsValue::from_str(&input.number));
    if !input.title.is_empty() {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("title"), &JsValue::from_str(&input.title));
    }
    if !input.short_title.is_empty() {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("shortTitle"), &JsValue::from_str(&input.short_title));
    }
    let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("type"), &JsValue::from_str(&input.input_type));
    let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("state"), &JsValue::from_str(&format!("{:?}", input.state)));
    if !input.position.is_empty() {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("position"), &JsValue::from_str(&input.position));
    }
    if !input.duration.is_empty() {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("duration"), &JsValue::from_str(&input.duration));
    }
    if let Some(muted) = input.muted {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("muted"), &JsValue::from_bool(muted));
    }
    if let Some(volume) = input.volume {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("volume"), &JsValue::from_str(&volume.to_string()));
    }
    if let Some(balance) = input.balance {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("balance"), &JsValue::from_str(&balance.to_string()));
    }
    if let Some(solo) = input.solo {
        let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("solo"), &JsValue::from_bool(solo));
    }
    
    let _ = js_sys::Reflect::set(&input_obj, &JsValue::from_str("$"), &attrs);
    input_obj
}


// Helper to convert transition to JS Object
fn transition_to_js(transition: &vmix_core::models::Transition) -> Object {
    let transition_obj = Object::new();
    let attrs = Object::new();
    
    let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("effect"), &JsValue::from_str(&transition.effect));
    let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("duration"), &JsValue::from_str(&transition.duration));
    
    let _ = js_sys::Reflect::set(&transition_obj, &JsValue::from_str("$"), &attrs);
    transition_obj
}

#[wasm_bindgen]
pub fn parse(xml: &str) -> JsValue {
    // Parse XML using quick-xml with vmix-core models (WASM compatible)
    let vmix_data: Vmix = match from_str(xml) {
        Ok(v) => v,
        Err(_) => {
            // Return empty structure on error
            let result = Object::new();
            let vmix_obj = Object::new();
            let _ = js_sys::Reflect::set(&result, &JsValue::from_str("vmix"), &vmix_obj);
            return result.into();
        }
    };
    
    convert_vmix_to_js(&vmix_data)
}

fn convert_vmix_to_js(vmix_data: &Vmix) -> JsValue {

    let vmix = Object::new();

    // Convert scalar values (wrap in arrays for xml2js format)
    if !vmix_data.version.is_empty() {
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("version"), &wrap_in_array(&vmix_data.version));
    }
    if !vmix_data.edition.is_empty() {
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("edition"), &wrap_in_array(&vmix_data.edition));
    }
    if let Some(v) = &vmix_data.preset {
        if !v.is_empty() {
            let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("preset"), &wrap_in_array(v));
        }
    }
    if !vmix_data.active.is_empty() {
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("active"), &wrap_in_array(&vmix_data.active));
    }
    if !vmix_data.preview.is_empty() {
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("preview"), &wrap_in_array(&vmix_data.preview));
    }
    let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("streaming"), &wrap_in_array(&vmix_data.streaming.to_string()));
    let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("fadeToBlack"), &wrap_in_array(&vmix_data.fade_to_black.to_string()));
    let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("external"), &wrap_in_array(&vmix_data.external.to_string()));
    let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("playList"), &wrap_in_array(&vmix_data.play_list.to_string()));
    let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("multiCorder"), &wrap_in_array(&vmix_data.multi_corder.to_string()));
    let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("fullscreen"), &wrap_in_array(&vmix_data.fullscreen.to_string()));

    // Convert inputs (Inputs struct has input field with Vec<Input>)
    if !vmix_data.inputs.input.is_empty() {
        let inputs = Array::new();
        for input in &vmix_data.inputs.input {
            inputs.push(&input_to_js(input).into());
        }
        let input_wrapper = Object::new();
        let _ = js_sys::Reflect::set(&input_wrapper, &JsValue::from_str("input"), &inputs);
        let inputs_arr = Array::new();
        inputs_arr.push(&input_wrapper);
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("inputs"), &inputs_arr);
    }

    // Convert overlays (Overlays struct has overlay field with Vec<Overlay>)
    if !vmix_data.overlays.overlay.is_empty() {
        let overlays = Array::new();
        for overlay_item in &vmix_data.overlays.overlay {
            let overlay_obj = Object::new();
            let attrs_obj = Object::new();
            if !overlay_item.number.is_empty() {
                let _ = js_sys::Reflect::set(&attrs_obj, &JsValue::from_str("number"), &JsValue::from_str(&overlay_item.number));
            }
            let _ = js_sys::Reflect::set(&overlay_obj, &JsValue::from_str("$"), &attrs_obj);
            overlays.push(&overlay_obj.into());
        }
        let overlay_wrapper = Object::new();
        let _ = js_sys::Reflect::set(&overlay_wrapper, &JsValue::from_str("overlay"), &overlays);
        let overlays_arr = Array::new();
        overlays_arr.push(&overlay_wrapper);
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("overlays"), &overlays_arr);
    }

    // Convert transitions (Transitions struct has transition field with Vec<Transition>)
    if !vmix_data.transitions.transition.is_empty() {
        let transitions = Array::new();
        for transition in &vmix_data.transitions.transition {
            transitions.push(&transition_to_js(transition).into());
        }
        let transition_wrapper = Object::new();
        let _ = js_sys::Reflect::set(&transition_wrapper, &JsValue::from_str("transition"), &transitions);
        let transitions_arr = Array::new();
        transitions_arr.push(&transition_wrapper);
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("transitions"), &transitions_arr);
    }

    // Convert audio
    {
        let audio = &vmix_data.audio;
        let audio_obj = Object::new();
        
        // Master bus
        {
            let master = &audio.master;
            let master_obj = Object::new();
            let attrs = Object::new();
            let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("volume"), &JsValue::from_str(&master.volume.to_string()));
            let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("muted"), &JsValue::from_bool(master.muted));
            let _ = js_sys::Reflect::set(&master_obj, &JsValue::from_str("$"), &attrs);
            let _ = js_sys::Reflect::set(&audio_obj, &JsValue::from_str("master"), &master_obj);
        }
        
        // Bus A-G (bus_h doesn't exist)
        for (i, bus) in [&audio.bus_a, &audio.bus_b, &audio.bus_c, &audio.bus_d, &audio.bus_e, &audio.bus_f, &audio.bus_g].iter().enumerate() {
            if let Some(bus_data) = bus {
                let bus_obj = Object::new();
                let attrs = Object::new();
                let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("volume"), &JsValue::from_str(&bus_data.volume.to_string()));
                let _ = js_sys::Reflect::set(&attrs, &JsValue::from_str("muted"), &JsValue::from_bool(bus_data.muted));
                let _ = js_sys::Reflect::set(&bus_obj, &JsValue::from_str("$"), &attrs);
                let bus_name = format!("bus{}", (b'A' + i as u8) as char);
                let _ = js_sys::Reflect::set(&audio_obj, &JsValue::from_str(&bus_name), &bus_obj);
            }
        }
        
        let audio_arr = Array::new();
        audio_arr.push(&audio_obj);
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("audio"), &audio_arr);
    }

    // Convert recording
    if vmix_data.recording {
        // recording is a bool, check if there's a duration field elsewhere
        // For now, just set recording as a boolean value
        let recording_arr = Array::new();
        let recording_obj = Object::new();
        let _ = js_sys::Reflect::set(&recording_obj, &JsValue::from_str("$"), &Object::new());
        recording_arr.push(&recording_obj);
        let _ = js_sys::Reflect::set(&vmix, &JsValue::from_str("recording"), &recording_arr);
    }

    // Wrap in final vmix object
    let result = Object::new();
    let _ = js_sys::Reflect::set(&result, &JsValue::from_str("vmix"), &vmix);
    result.into()
}


