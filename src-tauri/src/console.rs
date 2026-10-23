//! Preserve inherited pipes/files; attach to the calling console only for CLI runs.
#[cfg(windows)]
pub fn attach() {
    use std::ffi::c_void;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetStdHandle(kind: u32) -> *mut c_void;
        fn SetStdHandle(kind: u32, handle: *mut c_void) -> i32;
        fn AttachConsole(process: u32) -> i32;
    }
    // SAFETY: these Win32 calls only inspect/set this process's standard handles.
    // AttachConsole can replace inherited redirected handles, so restore valid ones.
    unsafe {
        let kinds = [(-10i32) as u32, (-11i32) as u32, (-12i32) as u32];
        let handles = kinds.map(|kind| GetStdHandle(kind));
        if AttachConsole(u32::MAX) != 0 {
            for (kind, handle) in kinds.into_iter().zip(handles) {
                if !handle.is_null() && handle as isize != -1 {
                    SetStdHandle(kind, handle);
                }
            }
        }
    }
}

#[cfg(not(windows))]
pub fn attach() {}
