use serde::{Deserialize, Serialize};
use std::{
    cmp::min,
    fs::File,
    io::{BufWriter, Write},
    path::Path,
};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Packing {
    Unpacked8,
    Unpacked16,
    MipiRaw10,
    MipiRaw12,
    MipiRaw14,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Endianness {
    Little,
    Big,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BitAlignment {
    Lsb,
    Msb,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum CfaPattern {
    Mono,
    Rggb,
    Bggr,
    Gbrg,
    Grbg,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawDescriptor {
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub packing: Packing,
    pub endianness: Endianness,
    pub bit_alignment: BitAlignment,
    pub cfa: CfaPattern,
    pub row_alignment: u64,
    pub row_stride: u64,
    pub frame_alignment: u64,
    pub frame_stride: u64,
    pub header_offset: u64,
}

impl Default for RawDescriptor {
    fn default() -> Self {
        Self {
            width: 1920,
            height: 1080,
            bit_depth: 10,
            packing: Packing::Unpacked16,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            cfa: CfaPattern::Rggb,
            row_alignment: 1,
            row_stride: 0,
            frame_alignment: 1,
            frame_stride: 0,
            header_offset: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WarningSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawWarning {
    pub severity: WarningSeverity,
    pub code: &'static str,
    pub message: String,
}

impl RawWarning {
    fn new(severity: WarningSeverity, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            severity,
            code,
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawLayout {
    pub row_bytes: u64,
    pub row_stride: u64,
    pub frame_bytes: u64,
    pub frame_stride: u64,
    pub frame_count: u64,
    pub complete_frame_count: u64,
    pub trailing_bytes: u64,
}

pub fn align_up(value: u64, alignment: u64) -> Option<u64> {
    let alignment = alignment.max(1);
    let remainder = value % alignment;
    if remainder == 0 {
        Some(value)
    } else {
        value.checked_add(alignment - remainder)
    }
}

pub fn minimum_row_bytes(descriptor: &RawDescriptor) -> Option<u64> {
    let width = u64::from(descriptor.width);
    match descriptor.packing {
        Packing::Unpacked8 => Some(width),
        Packing::Unpacked16 => width.checked_mul(2),
        Packing::MipiRaw10 => width.checked_add(3)?.checked_div(4)?.checked_mul(5),
        Packing::MipiRaw12 => width.checked_add(1)?.checked_div(2)?.checked_mul(3),
        Packing::MipiRaw14 => width.checked_add(3)?.checked_div(4)?.checked_mul(7),
    }
}

pub fn calculate_layout(
    descriptor: &RawDescriptor,
    file_size: u64,
) -> (RawLayout, Vec<RawWarning>) {
    let mut warnings = Vec::new();
    if descriptor.width == 0 || descriptor.height == 0 {
        warnings.push(RawWarning::new(
            WarningSeverity::Error,
            "empty_dimensions",
            "有效宽度和高度必须大于 0",
        ));
    }
    if !(8..=16).contains(&descriptor.bit_depth) {
        warnings.push(RawWarning::new(
            WarningSeverity::Error,
            "invalid_bit_depth",
            "位深必须在 8 到 16 bit 之间",
        ));
    }
    match descriptor.packing {
        Packing::Unpacked8 if descriptor.bit_depth > 8 => warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "container_too_small",
            "8-bit 容器无法保存超过 8 bit 的像素，显示时只读取低 8 bit",
        )),
        Packing::MipiRaw10 if descriptor.bit_depth != 10 => warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "packing_depth_mismatch",
            "MIPI RAW10 固定按 10 bit 解码；当前位深设置与打包格式不一致",
        )),
        Packing::MipiRaw12 if descriptor.bit_depth != 12 => warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "packing_depth_mismatch",
            "MIPI RAW12 固定按 12 bit 解码；当前位深设置与打包格式不一致",
        )),
        Packing::MipiRaw14 if descriptor.bit_depth != 14 => warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "packing_depth_mismatch",
            "MIPI RAW14 固定按 14 bit 解码；当前位深设置与打包格式不一致",
        )),
        _ => {}
    }

    let row_bytes = minimum_row_bytes(descriptor).unwrap_or(u64::MAX);
    let row_stride = if descriptor.row_stride == 0 {
        align_up(row_bytes, descriptor.row_alignment).unwrap_or(u64::MAX)
    } else {
        descriptor.row_stride
    };
    if row_stride < row_bytes {
        warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "short_row_stride",
            format!("行步长 {row_stride} B 小于有效行最小大小 {row_bytes} B；相邻行可能重叠，仍将尝试显示"),
        ));
    }
    let frame_bytes = row_stride.saturating_mul(u64::from(descriptor.height));
    let frame_stride = if descriptor.frame_stride == 0 {
        align_up(frame_bytes, descriptor.frame_alignment).unwrap_or(u64::MAX)
    } else {
        descriptor.frame_stride
    };
    if frame_stride < frame_bytes {
        warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "short_frame_stride",
            format!("帧步长 {frame_stride} B 小于帧数据大小 {frame_bytes} B；相邻帧可能重叠"),
        ));
    }

    let available = file_size.saturating_sub(descriptor.header_offset);
    if descriptor.header_offset > file_size {
        warnings.push(RawWarning::new(
            WarningSeverity::Error,
            "header_outside_file",
            "文件头偏移已超过文件末尾",
        ));
    }
    let (complete_frame_count, trailing_bytes, frame_count) =
        if frame_stride == 0 || frame_stride == u64::MAX {
            (0, available, 0)
        } else {
            let complete = available / frame_stride;
            let trailing = available % frame_stride;
            let count = complete + u64::from(trailing > 0);
            (complete, trailing, count)
        };
    if available > 0 && frame_count == 0 {
        warnings.push(RawWarning::new(
            WarningSeverity::Error,
            "no_decodable_frame",
            "当前参数无法定位可解码帧",
        ));
    } else if complete_frame_count == 0 && available > 0 {
        warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "partial_first_frame",
            "文件不足一帧，将显示第一帧中可读取的部分",
        ));
    } else if trailing_bytes > 0 {
        warnings.push(RawWarning::new(
            WarningSeverity::Warning,
            "partial_last_frame",
            format!("完整帧后还剩 {trailing_bytes} B，将其作为不完整的末帧显示"),
        ));
    }
    if frame_count > 1 {
        warnings.push(RawWarning::new(
            WarningSeverity::Info,
            "multiple_frames",
            format!("按当前参数识别到 {frame_count} 帧"),
        ));
    }

    (
        RawLayout {
            row_bytes,
            row_stride,
            frame_bytes,
            frame_stride,
            frame_count,
            complete_frame_count,
            trailing_bytes,
        },
        warnings,
    )
}

fn container_bit_depth(packing: Packing) -> u8 {
    match packing {
        Packing::Unpacked8 => 8,
        Packing::Unpacked16 => 16,
        Packing::MipiRaw10 => 10,
        Packing::MipiRaw12 => 12,
        Packing::MipiRaw14 => 14,
    }
}

pub fn read_pixel(
    data: &[u8],
    descriptor: &RawDescriptor,
    layout: &RawLayout,
    frame: u64,
    x: u32,
    y: u32,
) -> Option<u16> {
    if x >= descriptor.width || y >= descriptor.height || frame >= layout.frame_count {
        return None;
    }
    let frame_base = descriptor
        .header_offset
        .checked_add(frame.checked_mul(layout.frame_stride)?)?;
    let row_base = frame_base.checked_add(u64::from(y).checked_mul(layout.row_stride)?)?;
    let read = |offset: u64| data.get(usize::try_from(offset).ok()?).copied();
    let value = match descriptor.packing {
        Packing::Unpacked8 => u16::from(read(row_base.checked_add(u64::from(x))?)?),
        Packing::Unpacked16 => {
            let offset = row_base.checked_add(u64::from(x).checked_mul(2)?)?;
            let bytes = [read(offset)?, read(offset.checked_add(1)?)?];
            match descriptor.endianness {
                Endianness::Little => u16::from_le_bytes(bytes),
                Endianness::Big => u16::from_be_bytes(bytes),
            }
        }
        Packing::MipiRaw10 => {
            let group = u64::from(x / 4);
            let lane = u64::from(x % 4);
            let base = row_base.checked_add(group.checked_mul(5)?)?;
            let high = u16::from(read(base.checked_add(lane)?)?);
            let lows = u16::from(read(base.checked_add(4)?)?);
            (high << 2) | ((lows >> (lane * 2)) & 0x03)
        }
        Packing::MipiRaw12 => {
            let group = u64::from(x / 2);
            let lane = u64::from(x % 2);
            let base = row_base.checked_add(group.checked_mul(3)?)?;
            let high = u16::from(read(base.checked_add(lane)?)?);
            let lows = u16::from(read(base.checked_add(2)?)?);
            (high << 4) | ((lows >> (lane * 4)) & 0x0f)
        }
        Packing::MipiRaw14 => {
            let group = u64::from(x / 4);
            let lane = u64::from(x % 4);
            let base = row_base.checked_add(group.checked_mul(7)?)?;
            let high = u16::from(read(base.checked_add(lane)?)?) << 6;
            let packed_a = u16::from(read(base.checked_add(4)?)?);
            let packed_b = u16::from(read(base.checked_add(5)?)?);
            let packed_c = u16::from(read(base.checked_add(6)?)?);
            let low = match lane {
                0 => packed_a & 0x3f,
                1 => ((packed_a >> 6) & 0x03) | ((packed_b & 0x0f) << 2),
                2 => ((packed_b >> 4) & 0x0f) | ((packed_c & 0x03) << 4),
                _ => (packed_c >> 2) & 0x3f,
            };
            high | low
        }
    };
    let container_bits = container_bit_depth(descriptor.packing);
    let depth = descriptor.bit_depth.min(container_bits).max(1);
    let shifted = if descriptor.bit_alignment == BitAlignment::Msb
        && matches!(descriptor.packing, Packing::Unpacked8 | Packing::Unpacked16)
    {
        value >> (container_bits - depth)
    } else {
        value
    };
    let mask = if depth == 16 {
        u16::MAX
    } else {
        (1u16 << depth) - 1
    };
    Some(shifted & mask)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DisplayMode {
    Raw,
    Bayer,
    Demosaic,
    Red,
    Green,
    Blue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TileRequest {
    pub generation: u64,
    pub frame: u64,
    pub level: u8,
    pub tile_x: u32,
    pub tile_y: u32,
    pub tile_size: u16,
    pub mode: DisplayMode,
    pub display_min: u16,
    pub display_max: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelInspectionRequest {
    pub generation: u64,
    pub frame: u64,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub mode: DisplayMode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelSample {
    pub x: u32,
    pub y: u32,
    pub value: Option<u16>,
    pub channel: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CfaChannel {
    Mono,
    Red,
    Green,
    Blue,
}

fn cfa_channel(pattern: CfaPattern, x: u32, y: u32) -> CfaChannel {
    let i = ((y & 1) << 1) | (x & 1);
    match pattern {
        CfaPattern::Mono => CfaChannel::Mono,
        CfaPattern::Rggb => [
            CfaChannel::Red,
            CfaChannel::Green,
            CfaChannel::Green,
            CfaChannel::Blue,
        ][i as usize],
        CfaPattern::Bggr => [
            CfaChannel::Blue,
            CfaChannel::Green,
            CfaChannel::Green,
            CfaChannel::Red,
        ][i as usize],
        CfaPattern::Gbrg => [
            CfaChannel::Green,
            CfaChannel::Blue,
            CfaChannel::Red,
            CfaChannel::Green,
        ][i as usize],
        CfaPattern::Grbg => [
            CfaChannel::Green,
            CfaChannel::Red,
            CfaChannel::Blue,
            CfaChannel::Green,
        ][i as usize],
    }
}

pub fn cfa_name_at(pattern: CfaPattern, x: u32, y: u32) -> &'static str {
    match cfa_channel(pattern, x, y) {
        CfaChannel::Mono => "Y",
        CfaChannel::Red => "R",
        CfaChannel::Green => {
            if (y & 1) == 0 {
                "G₁"
            } else {
                "G₂"
            }
        }
        CfaChannel::Blue => "B",
    }
}

pub fn shifted_cfa(pattern: CfaPattern, x: u32, y: u32) -> CfaPattern {
    if pattern == CfaPattern::Mono {
        return pattern;
    }
    let channels = [
        cfa_channel(pattern, x, y),
        cfa_channel(pattern, x + 1, y),
        cfa_channel(pattern, x, y + 1),
        cfa_channel(pattern, x + 1, y + 1),
    ];
    match channels {
        [CfaChannel::Red, _, _, CfaChannel::Blue] => CfaPattern::Rggb,
        [CfaChannel::Blue, _, _, CfaChannel::Red] => CfaPattern::Bggr,
        [
            CfaChannel::Green,
            CfaChannel::Blue,
            CfaChannel::Red,
            CfaChannel::Green,
        ] => CfaPattern::Gbrg,
        _ => CfaPattern::Grbg,
    }
}

fn normalize(value: u16, low: u16, high: u16) -> u8 {
    if high <= low {
        return if value > low { 255 } else { 0 };
    }
    let value = value.clamp(low, high);
    (((u32::from(value - low) * 255) + u32::from(high - low) / 2) / u32::from(high - low)) as u8
}

fn interpolate_channel(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    x: u32,
    y: u32,
    wanted: CfaChannel,
) -> Option<u16> {
    if d.cfa == CfaPattern::Mono {
        return read_pixel(data, d, l, frame, x, y);
    }
    if cfa_channel(d.cfa, x, y) == wanted {
        return read_pixel(data, d, l, frame, x, y);
    }
    let mut sum = 0u32;
    let mut count = 0u32;
    for dy in -1i64..=1 {
        for dx in -1i64..=1 {
            if dx == 0 && dy == 0 {
                continue;
            }
            let nx = i64::from(x) + dx;
            let ny = i64::from(y) + dy;
            if nx < 0 || ny < 0 || nx >= i64::from(d.width) || ny >= i64::from(d.height) {
                continue;
            }
            let nx = nx as u32;
            let ny = ny as u32;
            if cfa_channel(d.cfa, nx, ny) == wanted {
                if let Some(v) = read_pixel(data, d, l, frame, nx, ny) {
                    sum += u32::from(v);
                    count += 1;
                }
            }
        }
    }
    (count > 0).then_some((sum / count) as u16)
}

fn sampled_rgb(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    point: (u32, u32),
    level: u8,
    mode: DisplayMode,
) -> Option<[u16; 3]> {
    let (x, y) = point;
    let value = read_pixel(data, d, l, frame, x, y)?;
    if d.cfa == CfaPattern::Mono {
        return Some([value; 3]);
    }
    match mode {
        DisplayMode::Raw => Some([value; 3]),
        DisplayMode::Bayer if level == 0 => match cfa_channel(d.cfa, x, y) {
            CfaChannel::Red => Some([value, 0, 0]),
            CfaChannel::Green => Some([0, value, 0]),
            CfaChannel::Blue => Some([0, 0, value]),
            CfaChannel::Mono => Some([value; 3]),
        },
        DisplayMode::Bayer => {
            let bx = x & !1;
            let by = y & !1;
            let mut sums = [0u32; 3];
            let mut counts = [0u32; 3];
            for cy in by..min(by + 2, d.height) {
                for cx in bx..min(bx + 2, d.width) {
                    if let Some(v) = read_pixel(data, d, l, frame, cx, cy) {
                        let index = match cfa_channel(d.cfa, cx, cy) {
                            CfaChannel::Red => 0,
                            CfaChannel::Green => 1,
                            CfaChannel::Blue => 2,
                            CfaChannel::Mono => 1,
                        };
                        sums[index] += u32::from(v);
                        counts[index] += 1;
                    }
                }
            }
            Some([0, 1, 2].map(|i| {
                if counts[i] > 0 {
                    (sums[i] / counts[i]) as u16
                } else {
                    0
                }
            }))
        }
        DisplayMode::Demosaic => Some([
            interpolate_channel(data, d, l, frame, x, y, CfaChannel::Red)?,
            interpolate_channel(data, d, l, frame, x, y, CfaChannel::Green)?,
            interpolate_channel(data, d, l, frame, x, y, CfaChannel::Blue)?,
        ]),
        DisplayMode::Red => {
            let v = interpolate_channel(data, d, l, frame, x, y, CfaChannel::Red)?;
            Some([v; 3])
        }
        DisplayMode::Green => {
            let v = interpolate_channel(data, d, l, frame, x, y, CfaChannel::Green)?;
            Some([v; 3])
        }
        DisplayMode::Blue => {
            let v = interpolate_channel(data, d, l, frame, x, y, CfaChannel::Blue)?;
            Some([v; 3])
        }
    }
}

pub fn render_tile(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    request: &TileRequest,
) -> Result<Vec<u8>, String> {
    let tile_size = request.tile_size.clamp(64, 1024) as u32;
    let scale = 1u64
        .checked_shl(u32::from(request.level.min(30)))
        .ok_or("缩放层级无效")?;
    let origin_x = u64::from(request.tile_x)
        .checked_mul(u64::from(tile_size))
        .and_then(|v| v.checked_mul(scale))
        .ok_or("瓦片坐标溢出")?;
    let origin_y = u64::from(request.tile_y)
        .checked_mul(u64::from(tile_size))
        .and_then(|v| v.checked_mul(scale))
        .ok_or("瓦片坐标溢出")?;
    let max_value = if request.display_max == 0 {
        if d.bit_depth >= 16 {
            u16::MAX
        } else {
            (1u16 << d.bit_depth.max(1)) - 1
        }
    } else {
        request.display_max
    };
    let mut output = vec![0u8; tile_size as usize * tile_size as usize * 4];
    for oy in 0..tile_size {
        for ox in 0..tile_size {
            let sx = origin_x + u64::from(ox) * scale + scale / 2;
            let sy = origin_y + u64::from(oy) * scale + scale / 2;
            let index = ((oy * tile_size + ox) * 4) as usize;
            if sx >= u64::from(d.width) || sy >= u64::from(d.height) {
                continue;
            }
            let rgba = sampled_rgb(
                data,
                d,
                l,
                request.frame,
                (sx as u32, sy as u32),
                request.level,
                request.mode,
            );
            if let Some(rgb) = rgba {
                output[index] = normalize(rgb[0], request.display_min, max_value);
                output[index + 1] = normalize(rgb[1], request.display_min, max_value);
                output[index + 2] = normalize(rgb[2], request.display_min, max_value);
                output[index + 3] = 255;
            } else {
                let light = ((ox / 12 + oy / 12) & 1) == 0;
                output[index..index + 4].copy_from_slice(if light {
                    &[82, 29, 48, 255]
                } else {
                    &[48, 20, 33, 255]
                });
            }
        }
    }
    Ok(output)
}

pub fn inspect_pixels(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    request: &PixelInspectionRequest,
) -> Result<Vec<u8>, String> {
    const BYTES_PER_PIXEL: usize = 10;
    const MAX_INSPECTION_PIXELS: u64 = 65_536;
    let pixel_count = u64::from(request.width)
        .checked_mul(u64::from(request.height))
        .ok_or("像素检查区域大小溢出")?;
    if pixel_count > MAX_INSPECTION_PIXELS {
        return Err(format!(
            "像素检查区域过大：{pixel_count}，最大允许 {MAX_INSPECTION_PIXELS} 个像素"
        ));
    }
    let output_len = usize::try_from(pixel_count)
        .ok()
        .and_then(|count| count.checked_mul(BYTES_PER_PIXEL))
        .ok_or("像素检查缓冲区大小溢出")?;
    let mut output = vec![0u8; output_len];
    for oy in 0..request.height {
        for ox in 0..request.width {
            let x = request.x.checked_add(ox).ok_or("像素检查 X 坐标溢出")?;
            let y = request.y.checked_add(oy).ok_or("像素检查 Y 坐标溢出")?;
            let index = usize::try_from(u64::from(oy) * u64::from(request.width) + u64::from(ox))
                .ok()
                .and_then(|value| value.checked_mul(BYTES_PER_PIXEL))
                .ok_or("像素检查数据索引溢出")?;
            let raw = read_pixel(data, d, l, request.frame, x, y);
            let rgb = sampled_rgb(data, d, l, request.frame, (x, y), 0, request.mode);
            if let Some(value) = raw {
                output[index] |= 0b0000_0001;
                output[index + 2..index + 4].copy_from_slice(&value.to_le_bytes());
            }
            if let Some([red, green, blue]) = rgb {
                output[index] |= 0b0000_0010;
                output[index + 4..index + 6].copy_from_slice(&red.to_le_bytes());
                output[index + 6..index + 8].copy_from_slice(&green.to_le_bytes());
                output[index + 8..index + 10].copy_from_slice(&blue.to_le_bytes());
            }
        }
    }
    Ok(output)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ValueMapping {
    Preserve,
    ScaleFullRange,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FrameSelection {
    Current,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub path: String,
    pub current_frame: u64,
    pub frame_selection: FrameSelection,
    pub crop_x: u32,
    pub crop_y: u32,
    pub crop_width: u32,
    pub crop_height: u32,
    pub packing: Packing,
    pub bit_depth: u8,
    pub endianness: Endianness,
    pub bit_alignment: BitAlignment,
    pub row_alignment: u64,
    pub frame_alignment: u64,
    pub value_mapping: ValueMapping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub bytes_written: u64,
    pub frames_written: u64,
    pub clipped_values: u64,
    pub output_cfa: CfaPattern,
}

fn output_row_bytes(width: u32, packing: Packing) -> Result<usize, String> {
    let d = RawDescriptor {
        width,
        packing,
        ..RawDescriptor::default()
    };
    usize::try_from(minimum_row_bytes(&d).ok_or("输出行大小溢出")?).map_err(|_| "输出行过大".into())
}

fn map_value(
    value: u16,
    source_depth: u8,
    target_depth: u8,
    mapping: ValueMapping,
    clipped: &mut u64,
) -> u16 {
    let source_max = if source_depth >= 16 {
        u16::MAX as u32
    } else {
        (1u32 << source_depth) - 1
    };
    let target_max = if target_depth >= 16 {
        u16::MAX as u32
    } else {
        (1u32 << target_depth) - 1
    };
    match mapping {
        ValueMapping::Preserve => {
            if u32::from(value) > target_max {
                *clipped += 1;
                target_max as u16
            } else {
                value
            }
        }
        ValueMapping::ScaleFullRange => {
            ((u32::from(value) * target_max + source_max / 2) / source_max.max(1)) as u16
        }
    }
}

fn encode_row(
    values: &[u16],
    packing: Packing,
    depth: u8,
    endian: Endianness,
    bit_alignment: BitAlignment,
) -> Result<Vec<u8>, String> {
    let mut row = vec![0u8; output_row_bytes(values.len() as u32, packing)?];
    match packing {
        Packing::Unpacked8 => {
            for (i, value) in values.iter().enumerate() {
                row[i] = *value as u8;
            }
        }
        Packing::Unpacked16 => {
            for (i, value) in values.iter().enumerate() {
                let stored = if bit_alignment == BitAlignment::Msb && depth < 16 {
                    value << (16 - depth)
                } else {
                    *value
                };
                let bytes = match endian {
                    Endianness::Little => stored.to_le_bytes(),
                    Endianness::Big => stored.to_be_bytes(),
                };
                row[i * 2..i * 2 + 2].copy_from_slice(&bytes);
            }
        }
        Packing::MipiRaw10 => {
            if depth != 10 {
                return Err("MIPI RAW10 输出要求 10 bit 位深".into());
            }
            for (group, chunk) in values.chunks(4).enumerate() {
                let base = group * 5;
                for lane in 0..4 {
                    let v = chunk.get(lane).copied().unwrap_or(0);
                    row[base + lane] = (v >> 2) as u8;
                    row[base + 4] |= ((v & 3) as u8) << (lane * 2);
                }
            }
        }
        Packing::MipiRaw12 => {
            if depth != 12 {
                return Err("MIPI RAW12 输出要求 12 bit 位深".into());
            }
            for (group, chunk) in values.chunks(2).enumerate() {
                let base = group * 3;
                let a = chunk.first().copied().unwrap_or(0);
                let b = chunk.get(1).copied().unwrap_or(0);
                row[base] = (a >> 4) as u8;
                row[base + 1] = (b >> 4) as u8;
                row[base + 2] = ((a & 15) | ((b & 15) << 4)) as u8;
            }
        }
        Packing::MipiRaw14 => {
            if depth != 14 {
                return Err("MIPI RAW14 输出要求 14 bit 位深".into());
            }
            for (group, chunk) in values.chunks(4).enumerate() {
                let base = group * 7;
                let pixels = [0, 1, 2, 3].map(|lane| chunk.get(lane).copied().unwrap_or(0));
                for (lane, value) in pixels.iter().enumerate() {
                    row[base + lane] = (value >> 6) as u8;
                }
                let lows = pixels.map(|value| (value & 0x3f) as u8);
                row[base + 4] = lows[0] | ((lows[1] & 0x03) << 6);
                row[base + 5] = (lows[1] >> 2) | ((lows[2] & 0x0f) << 4);
                row[base + 6] = (lows[2] >> 4) | (lows[3] << 2);
            }
        }
    }
    Ok(row)
}

fn write_zeroes(writer: &mut impl Write, mut count: usize, context: &str) -> Result<(), String> {
    const ZEROES: [u8; 8192] = [0; 8192];
    while count > 0 {
        let length = count.min(ZEROES.len());
        writer
            .write_all(&ZEROES[..length])
            .map_err(|error| format!("写入{context}失败：{error}"))?;
        count -= length;
    }
    Ok(())
}

pub fn export_raw(
    data: &[u8],
    source: &RawDescriptor,
    layout: &RawLayout,
    request: &ExportRequest,
) -> Result<ExportResult, String> {
    if request.crop_width == 0 || request.crop_height == 0 {
        return Err("裁剪宽度和高度必须大于 0".into());
    }
    if request
        .crop_x
        .checked_add(request.crop_width)
        .is_none_or(|v| v > source.width)
        || request
            .crop_y
            .checked_add(request.crop_height)
            .is_none_or(|v| v > source.height)
    {
        return Err("裁剪区域超出有效图像范围".into());
    }
    if !(8..=16).contains(&request.bit_depth) {
        return Err("输出位深必须在 8 到 16 bit 之间".into());
    }
    if request.packing == Packing::Unpacked8 && request.bit_depth > 8 {
        return Err("8-bit 容器不能保存超过 8 bit 的输出".into());
    }
    let frame_range: Box<dyn Iterator<Item = u64>> = match request.frame_selection {
        FrameSelection::Current => Box::new(std::iter::once(request.current_frame)),
        FrameSelection::All => Box::new(0..layout.frame_count),
    };
    let path = Path::new(&request.path);
    let mut writer = BufWriter::with_capacity(
        1024 * 1024,
        File::create(path).map_err(|e| format!("无法创建输出文件：{e}"))?,
    );
    let row_bytes = output_row_bytes(request.crop_width, request.packing)?;
    let row_stride =
        usize::try_from(align_up(row_bytes as u64, request.row_alignment).ok_or("输出行对齐溢出")?)
            .map_err(|_| "输出行步长过大")?;
    let frame_bytes = row_stride
        .checked_mul(request.crop_height as usize)
        .ok_or("输出帧大小溢出")?;
    let frame_stride = usize::try_from(
        align_up(frame_bytes as u64, request.frame_alignment).ok_or("输出帧对齐溢出")?,
    )
    .map_err(|_| "输出帧步长过大")?;
    let mut clipped = 0u64;
    let mut frames_written = 0u64;
    for frame in frame_range {
        if frame >= layout.frame_count {
            return Err(format!("帧索引 {frame} 超出范围"));
        }
        for y in request.crop_y..request.crop_y + request.crop_height {
            let mut values = Vec::with_capacity(request.crop_width as usize);
            for x in request.crop_x..request.crop_x + request.crop_width {
                let value = read_pixel(data, source, layout, frame, x, y).unwrap_or(0);
                values.push(map_value(
                    value,
                    source.bit_depth,
                    request.bit_depth,
                    request.value_mapping,
                    &mut clipped,
                ));
            }
            let row = encode_row(
                &values,
                request.packing,
                request.bit_depth,
                request.endianness,
                request.bit_alignment,
            )?;
            writer
                .write_all(&row)
                .map_err(|e| format!("写入输出文件失败：{e}"))?;
            write_zeroes(&mut writer, row_stride - row_bytes, "行填充")?;
        }
        write_zeroes(&mut writer, frame_stride - frame_bytes, "帧填充")?;
        frames_written += 1;
    }
    writer
        .flush()
        .map_err(|e| format!("刷新输出文件失败：{e}"))?;
    Ok(ExportResult {
        bytes_written: frames_written.saturating_mul(frame_stride as u64),
        frames_written,
        clipped_values: clipped,
        output_cfa: shifted_cfa(source.cfa, request.crop_x, request.crop_y),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_uses_byte_alignment_and_keeps_partial_frame() {
        let d = RawDescriptor {
            width: 5,
            height: 2,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            row_alignment: 4,
            frame_alignment: 16,
            ..RawDescriptor::default()
        };
        let (layout, warnings) = calculate_layout(&d, 20);
        assert_eq!(layout.row_bytes, 5);
        assert_eq!(layout.row_stride, 8);
        assert_eq!(layout.frame_stride, 16);
        assert_eq!(layout.frame_count, 2);
        assert!(warnings.iter().any(|w| w.code == "partial_last_frame"));
    }

    #[test]
    fn decodes_mipi_raw10_group() {
        let values = [0x001u16, 0x155, 0x2aa, 0x3ff];
        let bytes = encode_row(
            &values,
            Packing::MipiRaw10,
            10,
            Endianness::Little,
            BitAlignment::Lsb,
        )
        .unwrap();
        let d = RawDescriptor {
            width: 4,
            height: 1,
            bit_depth: 10,
            packing: Packing::MipiRaw10,
            ..RawDescriptor::default()
        };
        let (layout, _) = calculate_layout(&d, 5);
        for (x, expected) in values.into_iter().enumerate() {
            assert_eq!(
                read_pixel(&bytes, &d, &layout, 0, x as u32, 0),
                Some(expected)
            );
        }
    }

    #[test]
    fn decodes_mipi_raw12_group() {
        let values = [0xabcu16, 0x123];
        let bytes = encode_row(
            &values,
            Packing::MipiRaw12,
            12,
            Endianness::Little,
            BitAlignment::Lsb,
        )
        .unwrap();
        let d = RawDescriptor {
            width: 2,
            height: 1,
            bit_depth: 12,
            packing: Packing::MipiRaw12,
            ..RawDescriptor::default()
        };
        let (layout, _) = calculate_layout(&d, 3);
        assert_eq!(read_pixel(&bytes, &d, &layout, 0, 0, 0), Some(values[0]));
        assert_eq!(read_pixel(&bytes, &d, &layout, 0, 1, 0), Some(values[1]));
    }

    #[test]
    fn encodes_and_decodes_mipi_raw14_group() {
        let values = [0x001u16, 0x123, 0x2aaa, 0x3fff];
        let bytes = encode_row(
            &values,
            Packing::MipiRaw14,
            14,
            Endianness::Little,
            BitAlignment::Lsb,
        )
        .unwrap();
        assert_eq!(bytes, [0x00, 0x04, 0xaa, 0xff, 0xc1, 0xa8, 0xfe]);
        let d = RawDescriptor {
            width: 4,
            height: 1,
            bit_depth: 14,
            packing: Packing::MipiRaw14,
            ..RawDescriptor::default()
        };
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        assert_eq!(layout.row_bytes, 7);
        for (x, expected) in values.into_iter().enumerate() {
            assert_eq!(
                read_pixel(&bytes, &d, &layout, 0, x as u32, 0),
                Some(expected)
            );
        }
    }

    #[test]
    fn reads_odd_bit_depths_from_unpacked16() {
        for depth in [9u8, 11, 13, 15] {
            let expected = (1u16 << depth) - 1;
            let bytes = expected.to_le_bytes();
            let d = RawDescriptor {
                width: 1,
                height: 1,
                bit_depth: depth,
                packing: Packing::Unpacked16,
                ..RawDescriptor::default()
            };
            let (layout, _) = calculate_layout(&d, bytes.len() as u64);
            assert_eq!(read_pixel(&bytes, &d, &layout, 0, 0, 0), Some(expected));
        }
    }

    #[test]
    fn odd_crop_shifts_bayer_phase() {
        assert_eq!(shifted_cfa(CfaPattern::Rggb, 1, 0), CfaPattern::Grbg);
        assert_eq!(shifted_cfa(CfaPattern::Rggb, 0, 1), CfaPattern::Gbrg);
        assert_eq!(shifted_cfa(CfaPattern::Rggb, 1, 1), CfaPattern::Bggr);
    }

    #[test]
    fn reads_big_endian_msb_aligned_container() {
        let d = RawDescriptor {
            width: 2,
            height: 1,
            bit_depth: 10,
            packing: Packing::Unpacked16,
            endianness: Endianness::Big,
            bit_alignment: BitAlignment::Msb,
            ..RawDescriptor::default()
        };
        let bytes = [0xff, 0xc0, 0x55, 0x40];
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        assert_eq!(read_pixel(&bytes, &d, &layout, 0, 0, 0), Some(0x3ff));
        assert_eq!(read_pixel(&bytes, &d, &layout, 0, 1, 0), Some(0x155));
    }

    #[test]
    fn tile_renderer_marks_missing_source_data() {
        let d = RawDescriptor {
            width: 64,
            height: 64,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Mono,
            ..RawDescriptor::default()
        };
        let bytes = vec![128u8; 32];
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        let request = TileRequest {
            generation: 1,
            frame: 0,
            level: 0,
            tile_x: 0,
            tile_y: 0,
            tile_size: 64,
            mode: DisplayMode::Raw,
            display_min: 0,
            display_max: 255,
        };
        let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
        assert_eq!(&tile[0..4], &[128, 128, 128, 255]);
        let missing = 40 * 4;
        assert!(tile[missing] == 82 || tile[missing] == 48);
        assert_eq!(tile.len(), 64 * 64 * 4);
    }

    #[test]
    fn normalize_tolerates_inverted_display_range() {
        assert_eq!(normalize(99, 100, 50), 0);
        assert_eq!(normalize(100, 100, 50), 0);
        assert_eq!(normalize(101, 100, 50), 255);
    }

    #[test]
    fn demosaic_renderer_tolerates_partial_last_frame() {
        let d = RawDescriptor {
            width: 640,
            height: 480,
            bit_depth: 10,
            packing: Packing::MipiRaw10,
            cfa: CfaPattern::Rggb,
            frame_alignment: 1,
            ..RawDescriptor::default()
        };
        // 一帧需要 384000 B；额外 1024 B 会被识别为可尝试显示的不完整末帧。
        let bytes = vec![0x55u8; 385_024];
        let (layout, warnings) = calculate_layout(&d, bytes.len() as u64);
        assert_eq!(layout.frame_count, 2);
        assert!(
            warnings
                .iter()
                .any(|warning| warning.code == "partial_last_frame")
        );
        let request = TileRequest {
            generation: 1,
            frame: 1,
            level: 0,
            tile_x: 0,
            tile_y: 0,
            tile_size: 64,
            mode: DisplayMode::Demosaic,
            display_min: 0,
            display_max: 1023,
        };
        let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
        assert_eq!(tile.len(), 64 * 64 * 4);
        assert!(tile.chunks_exact(4).any(|pixel| pixel[3] == 255));
    }

    #[test]
    fn pixel_inspection_returns_raw_and_demosaic_components() {
        let d = RawDescriptor {
            width: 2,
            height: 2,
            bit_depth: 10,
            packing: Packing::Unpacked16,
            cfa: CfaPattern::Rggb,
            ..RawDescriptor::default()
        };
        let values = [100u16, 200, 300, 400];
        let bytes: Vec<u8> = values
            .iter()
            .flat_map(|value| value.to_le_bytes())
            .collect();
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        let request = PixelInspectionRequest {
            generation: 1,
            frame: 0,
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            mode: DisplayMode::Demosaic,
        };
        let inspected = inspect_pixels(&bytes, &d, &layout, &request).unwrap();
        assert_eq!(inspected.len(), 10);
        assert_eq!(inspected[0], 0b0000_0011);
        assert_eq!(u16::from_le_bytes([inspected[2], inspected[3]]), 100);
        assert_eq!(u16::from_le_bytes([inspected[4], inspected[5]]), 100);
        assert_eq!(u16::from_le_bytes([inspected[6], inspected[7]]), 250);
        assert_eq!(u16::from_le_bytes([inspected[8], inspected[9]]), 400);
    }

    #[test]
    fn pixel_inspection_limits_requested_area() {
        let d = RawDescriptor {
            bit_depth: 10,
            packing: Packing::Unpacked16,
            ..RawDescriptor::default()
        };
        let layout = calculate_layout(&d, 0).0;
        let request = PixelInspectionRequest {
            generation: 1,
            frame: 0,
            x: 0,
            y: 0,
            width: 257,
            height: 256,
            mode: DisplayMode::Raw,
        };
        let error = inspect_pixels(&[], &d, &layout, &request).unwrap_err();
        assert!(error.contains("区域过大"));
    }
}
