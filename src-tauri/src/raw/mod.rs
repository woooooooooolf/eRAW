use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{BufWriter, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
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
    Qrggb,
    Qbggr,
    Qgbrg,
    Qgrbg,
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
    pub cfa_phase_x: u8,
    pub cfa_phase_y: u8,
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
            cfa_phase_x: 0,
            cfa_phase_y: 0,
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
    Remosaic,
    Demosaic,
    Red,
    Green,
    Blue,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DemosaicAlgorithm {
    Bilinear,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemosaicOptions {
    pub same_color_reconstruction: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingSettings {
    pub demosaic_algorithm: DemosaicAlgorithm,
    pub remosaic: RemosaicOptions,
}

impl Default for ProcessingSettings {
    fn default() -> Self {
        Self {
            demosaic_algorithm: DemosaicAlgorithm::Bilinear,
            remosaic: RemosaicOptions {
                same_color_reconstruction: false,
            },
        }
    }
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
    pub processing: ProcessingSettings,
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
    pub processing: ProcessingSettings,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CfaSite {
    Mono,
    Red,
    GreenBlue,
    GreenRed,
    Blue,
}

pub fn is_quad_cfa(pattern: CfaPattern) -> bool {
    matches!(
        pattern,
        CfaPattern::Qrggb | CfaPattern::Qbggr | CfaPattern::Qgbrg | CfaPattern::Qgrbg
    )
}

fn bayer_base(pattern: CfaPattern) -> CfaPattern {
    match pattern {
        CfaPattern::Qrggb => CfaPattern::Rggb,
        CfaPattern::Qbggr => CfaPattern::Bggr,
        CfaPattern::Qgbrg => CfaPattern::Gbrg,
        CfaPattern::Qgrbg => CfaPattern::Grbg,
        other => other,
    }
}

fn bayer_channel(pattern: CfaPattern, x: u32, y: u32) -> CfaChannel {
    let i = ((y & 1) << 1) | (x & 1);
    match bayer_base(pattern) {
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
        _ => unreachable!("Quad CFA patterns are reduced to their Bayer base"),
    }
}

fn bayer_site(pattern: CfaPattern, x: u32, y: u32) -> CfaSite {
    let i = (((y & 1) << 1) | (x & 1)) as usize;
    match bayer_base(pattern) {
        CfaPattern::Mono => CfaSite::Mono,
        CfaPattern::Rggb => [
            CfaSite::Red,
            CfaSite::GreenRed,
            CfaSite::GreenBlue,
            CfaSite::Blue,
        ][i],
        CfaPattern::Bggr => [
            CfaSite::Blue,
            CfaSite::GreenBlue,
            CfaSite::GreenRed,
            CfaSite::Red,
        ][i],
        CfaPattern::Gbrg => [
            CfaSite::GreenBlue,
            CfaSite::Blue,
            CfaSite::Red,
            CfaSite::GreenRed,
        ][i],
        CfaPattern::Grbg => [
            CfaSite::GreenRed,
            CfaSite::Red,
            CfaSite::Blue,
            CfaSite::GreenBlue,
        ][i],
        _ => unreachable!("Quad CFA patterns are reduced to their Bayer base"),
    }
}

fn cfa_channel_with_phase(
    pattern: CfaPattern,
    phase_x: u8,
    phase_y: u8,
    x: u32,
    y: u32,
) -> CfaChannel {
    if is_quad_cfa(pattern) {
        let macro_x = ((x + u32::from(phase_x % 4)) % 4) / 2;
        let macro_y = ((y + u32::from(phase_y % 4)) % 4) / 2;
        bayer_channel(pattern, macro_x, macro_y)
    } else {
        bayer_channel(pattern, x, y)
    }
}

fn cfa_site_with_phase(pattern: CfaPattern, phase_x: u8, phase_y: u8, x: u32, y: u32) -> CfaSite {
    if is_quad_cfa(pattern) {
        let macro_x = ((x + u32::from(phase_x % 4)) % 4) / 2;
        let macro_y = ((y + u32::from(phase_y % 4)) % 4) / 2;
        bayer_site(pattern, macro_x, macro_y)
    } else {
        bayer_site(pattern, x, y)
    }
}

fn cfa_channel(d: &RawDescriptor, x: u32, y: u32) -> CfaChannel {
    cfa_channel_with_phase(d.cfa, d.cfa_phase_x, d.cfa_phase_y, x, y)
}

fn cfa_site(d: &RawDescriptor, x: u32, y: u32) -> CfaSite {
    cfa_site_with_phase(d.cfa, d.cfa_phase_x, d.cfa_phase_y, x, y)
}

pub fn cfa_name_at(d: &RawDescriptor, x: u32, y: u32) -> &'static str {
    match cfa_site(d, x, y) {
        CfaSite::Mono => "Y",
        CfaSite::Red => "R",
        CfaSite::GreenBlue => "Gb",
        CfaSite::GreenRed => "Gr",
        CfaSite::Blue => "B",
    }
}

pub fn shifted_cfa(pattern: CfaPattern, x: u32, y: u32) -> CfaPattern {
    if pattern == CfaPattern::Mono || is_quad_cfa(pattern) {
        return pattern;
    }
    let channels = [
        bayer_channel(pattern, x, y),
        bayer_channel(pattern, x + 1, y),
        bayer_channel(pattern, x, y + 1),
        bayer_channel(pattern, x + 1, y + 1),
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

fn remosaic_output_site(d: &RawDescriptor, x: u32, y: u32) -> CfaSite {
    let phase_x = u32::from(d.cfa_phase_x % 4);
    let phase_y = u32::from(d.cfa_phase_y % 4);
    bayer_site(bayer_base(d.cfa), x + phase_x, y + phase_y)
}

fn remosaic_output_channel(d: &RawDescriptor, x: u32, y: u32) -> CfaChannel {
    let phase_x = u32::from(d.cfa_phase_x % 4);
    let phase_y = u32::from(d.cfa_phase_y % 4);
    bayer_channel(bayer_base(d.cfa), x + phase_x, y + phase_y)
}

fn reordered_source_coordinate(value: u32, phase: u8) -> Option<u32> {
    let phase = i64::from(phase % 4);
    let shifted = i64::from(value) + phase;
    let block = shifted.div_euclid(4) * 4;
    let local = shifted.rem_euclid(4) as u32;
    let reordered = ((local & 1) << 1) | (local >> 1);
    u32::try_from(block + i64::from(reordered) - phase).ok()
}

fn reordered_pixel(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    x: u32,
    y: u32,
) -> Option<u16> {
    let source_x = reordered_source_coordinate(x, d.cfa_phase_x)?;
    let source_y = reordered_source_coordinate(y, d.cfa_phase_y)?;
    read_pixel(data, d, l, frame, source_x, source_y)
}

fn site_axis_residues(d: &RawDescriptor, wanted: CfaSite, horizontal: bool) -> [bool; 4] {
    let mut allowed = [false; 4];
    for y in 0..4 {
        for x in 0..4 {
            if cfa_site(d, x, y) == wanted {
                allowed[if horizontal { x as usize } else { y as usize }] = true;
            }
        }
    }
    allowed
}

fn enclosing_coordinates(value: u32, limit: u32, allowed: [bool; 4]) -> Option<(u32, u32)> {
    if limit == 0 {
        return None;
    }
    let left = (0..=value.min(limit - 1))
        .rev()
        .find(|candidate| allowed[(*candidate % 4) as usize]);
    let right = (value.min(limit - 1)..limit).find(|candidate| allowed[(*candidate % 4) as usize]);
    match (left, right) {
        (Some(left), Some(right)) => Some((left, right)),
        (Some(value), None) | (None, Some(value)) => Some((value, value)),
        (None, None) => None,
    }
}

fn same_site_bilinear_pixel(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    x: u32,
    y: u32,
) -> Option<u16> {
    let wanted = remosaic_output_site(d, x, y);
    if cfa_site(d, x, y) == wanted {
        if let Some(value) = read_pixel(data, d, l, frame, x, y) {
            return Some(value);
        }
    }
    let (x0, x1) = enclosing_coordinates(x, d.width, site_axis_residues(d, wanted, true))?;
    let (y0, y1) = enclosing_coordinates(y, d.height, site_axis_residues(d, wanted, false))?;
    let xs: &[(u32, u64)] = if x0 == x1 {
        &[(x0, 1)]
    } else {
        &[(x0, u64::from(x1 - x)), (x1, u64::from(x - x0))]
    };
    let ys: &[(u32, u64)] = if y0 == y1 {
        &[(y0, 1)]
    } else {
        &[(y0, u64::from(y1 - y)), (y1, u64::from(y - y0))]
    };
    let mut weighted_sum = 0u64;
    let mut total_weight = 0u64;
    for (sample_y, weight_y) in ys {
        for (sample_x, weight_x) in xs {
            let weight = weight_x * weight_y;
            if weight == 0 {
                continue;
            }
            if let Some(value) = read_pixel(data, d, l, frame, *sample_x, *sample_y) {
                weighted_sum += u64::from(value) * weight;
                total_weight += weight;
            }
        }
    }
    if total_weight > 0 {
        Some(((weighted_sum + total_weight / 2) / total_weight) as u16)
    } else {
        None
    }
}

fn remosaic_pixel(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    x: u32,
    y: u32,
    options: RemosaicOptions,
) -> Option<u16> {
    if !is_quad_cfa(d.cfa) {
        return read_pixel(data, d, l, frame, x, y);
    }
    if options.same_color_reconstruction {
        same_site_bilinear_pixel(data, d, l, frame, x, y)
    } else {
        reordered_pixel(data, d, l, frame, x, y)
    }
}

fn processed_bayer_value(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    x: u32,
    y: u32,
    processing: ProcessingSettings,
) -> Option<u16> {
    if is_quad_cfa(d.cfa) {
        remosaic_pixel(data, d, l, frame, x, y, processing.remosaic)
    } else {
        read_pixel(data, d, l, frame, x, y)
    }
}

fn processed_bayer_channel(d: &RawDescriptor, x: u32, y: u32) -> CfaChannel {
    if is_quad_cfa(d.cfa) {
        remosaic_output_channel(d, x, y)
    } else {
        cfa_channel(d, x, y)
    }
}

fn interpolate_processed_channel(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    x: u32,
    y: u32,
    wanted: CfaChannel,
    processing: ProcessingSettings,
) -> Option<u16> {
    if d.cfa == CfaPattern::Mono {
        return read_pixel(data, d, l, frame, x, y);
    }
    if processed_bayer_channel(d, x, y) == wanted {
        return processed_bayer_value(data, d, l, frame, x, y, processing);
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
            if processed_bayer_channel(d, nx, ny) == wanted {
                if let Some(v) = processed_bayer_value(data, d, l, frame, nx, ny, processing) {
                    sum += u32::from(v);
                    count += 1;
                }
            }
        }
    }
    if count > 0 {
        Some((sum / count) as u16)
    } else {
        None
    }
}

fn sampled_rgb_l0(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    point: (u32, u32),
    mode: DisplayMode,
    processing: ProcessingSettings,
) -> Option<[u16; 3]> {
    let (x, y) = point;
    if d.cfa == CfaPattern::Mono {
        let value = read_pixel(data, d, l, frame, x, y)?;
        return Some([value; 3]);
    }
    match mode {
        DisplayMode::Raw => {
            let value = read_pixel(data, d, l, frame, x, y)?;
            Some([value; 3])
        }
        DisplayMode::Bayer => {
            let value = read_pixel(data, d, l, frame, x, y)?;
            match cfa_channel(d, x, y) {
                CfaChannel::Red => Some([value, 0, 0]),
                CfaChannel::Green => Some([0, value, 0]),
                CfaChannel::Blue => Some([0, 0, value]),
                CfaChannel::Mono => Some([value; 3]),
            }
        }
        DisplayMode::Remosaic => {
            let value = remosaic_pixel(data, d, l, frame, x, y, processing.remosaic)?;
            match remosaic_output_channel(d, x, y) {
                CfaChannel::Red => Some([value, 0, 0]),
                CfaChannel::Green => Some([0, value, 0]),
                CfaChannel::Blue => Some([0, 0, value]),
                CfaChannel::Mono => Some([value; 3]),
            }
        }
        DisplayMode::Demosaic => Some([
            interpolate_processed_channel(data, d, l, frame, x, y, CfaChannel::Red, processing)?,
            interpolate_processed_channel(data, d, l, frame, x, y, CfaChannel::Green, processing)?,
            interpolate_processed_channel(data, d, l, frame, x, y, CfaChannel::Blue, processing)?,
        ]),
        DisplayMode::Red => {
            let v = interpolate_processed_channel(
                data,
                d,
                l,
                frame,
                x,
                y,
                CfaChannel::Red,
                processing,
            )?;
            Some([v; 3])
        }
        DisplayMode::Green => {
            let v = interpolate_processed_channel(
                data,
                d,
                l,
                frame,
                x,
                y,
                CfaChannel::Green,
                processing,
            )?;
            Some([v; 3])
        }
        DisplayMode::Blue => {
            let v = interpolate_processed_channel(
                data,
                d,
                l,
                frame,
                x,
                y,
                CfaChannel::Blue,
                processing,
            )?;
            Some([v; 3])
        }
    }
}

fn average(sum: u64, count: u64) -> u16 {
    ((sum + count / 2) / count) as u16
}

fn aggregate_rgb(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    frame: u64,
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
    mode: DisplayMode,
    processing: ProcessingSettings,
) -> Option<[u16; 3]> {
    let mut raw_sum = 0u64;
    let mut raw_count = 0u64;
    let mut channel_sums = [0u64; 3];
    let mut channel_counts = [0u64; 3];
    for y in y0..y1 {
        for x in x0..x1 {
            let processed_mode =
                is_quad_cfa(d.cfa) && !matches!(mode, DisplayMode::Raw | DisplayMode::Bayer);
            let value = if processed_mode {
                processed_bayer_value(data, d, l, frame, x, y, processing)
            } else {
                read_pixel(data, d, l, frame, x, y)
            };
            let Some(value) = value else {
                continue;
            };
            raw_sum += u64::from(value);
            raw_count += 1;
            let cfa_channel = if processed_mode {
                processed_bayer_channel(d, x, y)
            } else {
                cfa_channel(d, x, y)
            };
            let channel = match cfa_channel {
                CfaChannel::Red => 0,
                CfaChannel::Green | CfaChannel::Mono => 1,
                CfaChannel::Blue => 2,
            };
            channel_sums[channel] += u64::from(value);
            channel_counts[channel] += 1;
        }
    }
    if raw_count == 0 {
        return None;
    }
    let raw = average(raw_sum, raw_count);
    if d.cfa == CfaPattern::Mono || matches!(mode, DisplayMode::Raw) {
        return Some([raw; 3]);
    }
    let channel_value = |index: usize| {
        (channel_counts[index] > 0).then(|| average(channel_sums[index], channel_counts[index]))
    };
    match mode {
        DisplayMode::Bayer | DisplayMode::Remosaic => Some([
            channel_value(0).unwrap_or(0),
            channel_value(1).unwrap_or(0),
            channel_value(2).unwrap_or(0),
        ]),
        DisplayMode::Demosaic => Some([
            channel_value(0).unwrap_or(raw),
            channel_value(1).unwrap_or(raw),
            channel_value(2).unwrap_or(raw),
        ]),
        DisplayMode::Red => channel_value(0).map(|value| [value; 3]),
        DisplayMode::Green => channel_value(1).map(|value| [value; 3]),
        DisplayMode::Blue => channel_value(2).map(|value| [value; 3]),
        DisplayMode::Raw => Some([raw; 3]),
    }
}

#[cfg(test)]
fn render_tile(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    request: &TileRequest,
) -> Result<Vec<u8>, String> {
    render_tile_cancellable(data, d, l, request, || true)
}

pub fn render_tile_cancellable(
    data: &[u8],
    d: &RawDescriptor,
    l: &RawLayout,
    request: &TileRequest,
    is_current: impl Fn() -> bool,
) -> Result<Vec<u8>, String> {
    let tile_size = request.tile_size.clamp(64, 1024) as u32;
    let scale = 1u32
        .checked_shl(u32::from(request.level.min(30)))
        .ok_or("缩放层级无效")?;
    let origin_x = u64::from(request.tile_x)
        .checked_mul(u64::from(tile_size))
        .and_then(|v| v.checked_mul(u64::from(scale)))
        .ok_or("瓦片坐标溢出")?;
    let origin_y = u64::from(request.tile_y)
        .checked_mul(u64::from(tile_size))
        .and_then(|v| v.checked_mul(u64::from(scale)))
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
        if !is_current() {
            return Err("stale_generation".into());
        }
        for ox in 0..tile_size {
            if !is_current() {
                return Err("stale_generation".into());
            }
            let sx = origin_x + u64::from(ox) * u64::from(scale);
            let sy = origin_y + u64::from(oy) * u64::from(scale);
            let index = ((oy * tile_size + ox) * 4) as usize;
            if sx >= u64::from(d.width) || sy >= u64::from(d.height) {
                continue;
            }
            let x0 = sx as u32;
            let y0 = sy as u32;
            let rgba = if request.level == 0 {
                sampled_rgb_l0(
                    data,
                    d,
                    l,
                    request.frame,
                    (x0, y0),
                    request.mode,
                    request.processing,
                )
            } else {
                aggregate_rgb(
                    data,
                    d,
                    l,
                    request.frame,
                    x0,
                    y0,
                    x0.saturating_add(scale).min(d.width),
                    y0.saturating_add(scale).min(d.height),
                    request.mode,
                    request.processing,
                )
            };
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
            let raw = if is_quad_cfa(d.cfa)
                && matches!(request.mode, DisplayMode::Remosaic | DisplayMode::Demosaic)
            {
                remosaic_pixel(data, d, l, request.frame, x, y, request.processing.remosaic)
            } else {
                read_pixel(data, d, l, request.frame, x, y)
            };
            let rgb = sampled_rgb_l0(
                data,
                d,
                l,
                request.frame,
                (x, y),
                request.mode,
                request.processing,
            );
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ExportTarget {
    OriginalCfa,
    Remosaic,
    Demosaic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub path: String,
    pub source_path: String,
    pub source_generation: u64,
    pub source_descriptor: RawDescriptor,
    pub target: ExportTarget,
    pub processing: ProcessingSettings,
    pub current_frame: u64,
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
    pub missing_pixel_fill: MissingPixelFill,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingPixelFill {
    pub mono: u32,
    pub red: u32,
    pub green_blue: u32,
    pub green_red: u32,
    pub blue: u32,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingPixelCounts {
    pub mono: u64,
    pub red: u64,
    pub green_blue: u64,
    pub green_red: u64,
    pub blue: u64,
    pub rgb: u64,
}

impl MissingPixelFill {
    fn value_for(
        &self,
        descriptor: &RawDescriptor,
        x: u32,
        y: u32,
        counts: &mut MissingPixelCounts,
    ) -> u16 {
        match cfa_site(descriptor, x, y) {
            CfaSite::Mono => {
                counts.mono += 1;
                self.mono as u16
            }
            CfaSite::Red => {
                counts.red += 1;
                self.red as u16
            }
            CfaSite::GreenBlue => {
                counts.green_blue += 1;
                self.green_blue as u16
            }
            CfaSite::GreenRed => {
                counts.green_red += 1;
                self.green_red as u16
            }
            CfaSite::Blue => {
                counts.blue += 1;
                self.blue as u16
            }
        }
    }

    fn validate(&self, descriptor: &RawDescriptor, maximum: u32) -> Result<(), String> {
        let values: &[(&str, u32)] = if descriptor.cfa == CfaPattern::Mono {
            &[("MONO", self.mono)]
        } else {
            &[
                ("R", self.red),
                ("Gb", self.green_blue),
                ("Gr", self.green_red),
                ("B", self.blue),
            ]
        };
        if let Some((name, value)) = values.iter().find(|(_, value)| *value > maximum) {
            return Err(format!(
                "{name} 缺失像素填充值 {value} 超出当前输出位深允许的 0–{maximum}"
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub bytes_written: u64,
    pub clipped_values: u64,
    pub filled_pixels: MissingPixelCounts,
    pub output_cfa: Option<CfaPattern>,
    pub output_cfa_phase_x: u8,
    pub output_cfa_phase_y: u8,
    pub output_channels: u8,
    pub output_bit_depth: u8,
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

static TEMPORARY_FILE_COUNTER: AtomicU64 = AtomicU64::new(1);

fn sibling_path(target: &Path, purpose: &str) -> PathBuf {
    let parent = target
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let name = target
        .file_name()
        .map(|value| value.to_string_lossy())
        .unwrap_or_else(|| "output.raw".into());
    let sequence = TEMPORARY_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    parent.join(format!(
        ".{name}.eraw-{}-{sequence}.{purpose}",
        std::process::id()
    ))
}

fn create_temporary_output(target: &Path) -> Result<(PathBuf, File), String> {
    for _ in 0..100 {
        let path = sibling_path(target, "tmp");
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("无法在输出目录创建临时文件：{error}")),
        }
    }
    Err("无法为导出任务分配唯一临时文件".into())
}

fn commit_temporary_output(temporary: &Path, target: &Path) -> Result<(), String> {
    if !target.exists() {
        return fs::rename(temporary, target).map_err(|error| format!("无法完成输出文件：{error}"));
    }
    if target.is_dir() {
        return Err("所选输出路径是目录，无法写入 RAW 文件".into());
    }
    let backup = loop {
        let candidate = sibling_path(target, "backup");
        if !candidate.exists() {
            break candidate;
        }
    };
    fs::rename(target, &backup).map_err(|error| format!("无法暂存已有输出文件：{error}"))?;
    if let Err(error) = fs::rename(temporary, target) {
        let restore_error = fs::rename(&backup, target).err();
        return Err(match restore_error {
            Some(restore) => {
                format!("无法完成输出文件：{error}；恢复原文件也失败：{restore}")
            }
            None => format!("无法完成输出文件：{error}；原文件已恢复"),
        });
    }
    let _ = fs::remove_file(backup);
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
    if request.target != ExportTarget::Demosaic {
        match request.packing {
            Packing::Unpacked8 if request.bit_depth != 8 => {
                return Err("Unpacked 8 输出固定使用 8 bit 位深".into());
            }
            Packing::MipiRaw10 if request.bit_depth != 10 => {
                return Err("MIPI RAW10 输出固定使用 10 bit 位深".into());
            }
            Packing::MipiRaw12 if request.bit_depth != 12 => {
                return Err("MIPI RAW12 输出固定使用 12 bit 位深".into());
            }
            Packing::MipiRaw14 if request.bit_depth != 14 => {
                return Err("MIPI RAW14 输出固定使用 14 bit 位深".into());
            }
            _ => {}
        }
    }
    if request.target == ExportTarget::Remosaic && !is_quad_cfa(source.cfa) {
        return Err("只有 Quad CFA 来源可以导出 Remosaic Bayer".into());
    }
    if request.target == ExportTarget::Demosaic && source.cfa == CfaPattern::Mono {
        return Err("Mono 来源不支持 Demosaic RGB 导出".into());
    }
    if request.row_alignment == 0 || request.frame_alignment == 0 {
        return Err("输出行对齐和帧对齐必须大于 0".into());
    }
    if request.current_frame >= layout.frame_count {
        return Err(format!("当前帧索引 {} 超出范围", request.current_frame));
    }
    let output_bit_depth = if request.target == ExportTarget::Demosaic {
        source.bit_depth
    } else {
        request.bit_depth
    };
    let output_maximum = if output_bit_depth >= 16 {
        u16::MAX as u32
    } else {
        (1u32 << output_bit_depth) - 1
    };
    let mut processed_descriptor = source.clone();
    if is_quad_cfa(source.cfa) {
        processed_descriptor.cfa = shifted_cfa(
            bayer_base(source.cfa),
            u32::from(source.cfa_phase_x % 2),
            u32::from(source.cfa_phase_y % 2),
        );
        processed_descriptor.cfa_phase_x = 0;
        processed_descriptor.cfa_phase_y = 0;
    }
    let fill_descriptor = if request.target == ExportTarget::OriginalCfa {
        source
    } else {
        &processed_descriptor
    };
    request
        .missing_pixel_fill
        .validate(fill_descriptor, output_maximum)?;
    let row_bytes = if request.target == ExportTarget::Demosaic {
        usize::try_from(request.crop_width)
            .ok()
            .and_then(|width| width.checked_mul(6))
            .ok_or("RGB48 输出行大小溢出")?
    } else {
        output_row_bytes(request.crop_width, request.packing)?
    };
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

    let path = Path::new(&request.path);
    let (temporary_path, temporary_file) = create_temporary_output(path)?;
    let write_result = (|| {
        let mut writer = BufWriter::with_capacity(1024 * 1024, temporary_file);
        let mut clipped = 0u64;
        let mut filled = MissingPixelCounts::default();
        for y in request.crop_y..request.crop_y + request.crop_height {
            let row = if request.target == ExportTarget::Demosaic {
                let mut row = Vec::with_capacity(row_bytes);
                for x in request.crop_x..request.crop_x + request.crop_width {
                    let rgb = sampled_rgb_l0(
                        data,
                        source,
                        layout,
                        request.current_frame,
                        (x, y),
                        DisplayMode::Demosaic,
                        request.processing,
                    )
                    .unwrap_or_else(|| {
                        filled.rgb += 1;
                        [
                            request.missing_pixel_fill.red as u16,
                            ((request.missing_pixel_fill.green_red
                                + request.missing_pixel_fill.green_blue
                                + 1)
                                / 2) as u16,
                            request.missing_pixel_fill.blue as u16,
                        ]
                    });
                    for value in rgb {
                        let bytes = match request.endianness {
                            Endianness::Little => value.to_le_bytes(),
                            Endianness::Big => value.to_be_bytes(),
                        };
                        row.extend_from_slice(&bytes);
                    }
                }
                row
            } else {
                let mut values = Vec::with_capacity(request.crop_width as usize);
                for x in request.crop_x..request.crop_x + request.crop_width {
                    let source_value = match request.target {
                        ExportTarget::OriginalCfa => {
                            read_pixel(data, source, layout, request.current_frame, x, y)
                        }
                        ExportTarget::Remosaic => remosaic_pixel(
                            data,
                            source,
                            layout,
                            request.current_frame,
                            x,
                            y,
                            request.processing.remosaic,
                        ),
                        ExportTarget::Demosaic => unreachable!(),
                    };
                    let value = match source_value {
                        Some(value) => map_value(
                            value,
                            source.bit_depth,
                            request.bit_depth,
                            request.value_mapping,
                            &mut clipped,
                        ),
                        None => {
                            request
                                .missing_pixel_fill
                                .value_for(fill_descriptor, x, y, &mut filled)
                        }
                    };
                    values.push(value);
                }
                encode_row(
                    &values,
                    request.packing,
                    request.bit_depth,
                    request.endianness,
                    request.bit_alignment,
                )?
            };
            writer
                .write_all(&row)
                .map_err(|e| format!("写入输出文件失败：{e}"))?;
            write_zeroes(&mut writer, row_stride - row_bytes, "行填充")?;
        }
        write_zeroes(&mut writer, frame_stride - frame_bytes, "帧填充")?;
        writer
            .flush()
            .map_err(|error| format!("刷新输出文件失败：{error}"))?;
        Ok::<_, String>((clipped, filled))
    })();

    let (clipped_values, filled_pixels) = match write_result {
        Ok(result) => result,
        Err(error) => {
            let _ = fs::remove_file(&temporary_path);
            return Err(error);
        }
    };
    if let Err(error) = commit_temporary_output(&temporary_path, path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }
    let (output_cfa, output_cfa_phase_x, output_cfa_phase_y) = match request.target {
        ExportTarget::OriginalCfa if is_quad_cfa(source.cfa) => (
            Some(source.cfa),
            ((u32::from(source.cfa_phase_x) + request.crop_x) % 4) as u8,
            ((u32::from(source.cfa_phase_y) + request.crop_y) % 4) as u8,
        ),
        ExportTarget::OriginalCfa => (
            Some(shifted_cfa(source.cfa, request.crop_x, request.crop_y)),
            0,
            0,
        ),
        ExportTarget::Remosaic => (
            Some(shifted_cfa(
                processed_descriptor.cfa,
                request.crop_x,
                request.crop_y,
            )),
            0,
            0,
        ),
        ExportTarget::Demosaic => (None, 0, 0),
    };
    Ok(ExportResult {
        bytes_written: frame_stride as u64,
        clipped_values,
        filled_pixels,
        output_cfa,
        output_cfa_phase_x,
        output_cfa_phase_y,
        output_channels: if request.target == ExportTarget::Demosaic {
            3
        } else {
            1
        },
        output_bit_depth,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_export_request(
        descriptor: &RawDescriptor,
        output: &Path,
        target: ExportTarget,
    ) -> ExportRequest {
        ExportRequest {
            path: output.to_string_lossy().into_owned(),
            source_path: "source.raw".into(),
            source_generation: 1,
            source_descriptor: descriptor.clone(),
            target,
            processing: ProcessingSettings::default(),
            current_frame: 0,
            crop_x: 0,
            crop_y: 0,
            crop_width: descriptor.width,
            crop_height: descriptor.height,
            packing: if descriptor.bit_depth == 8 {
                Packing::Unpacked8
            } else {
                Packing::Unpacked16
            },
            bit_depth: descriptor.bit_depth,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            row_alignment: 1,
            frame_alignment: 1,
            value_mapping: ValueMapping::Preserve,
            missing_pixel_fill: MissingPixelFill {
                mono: 0,
                red: 0,
                green_blue: 0,
                green_red: 0,
                blue: 0,
            },
        }
    }

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
            processing: ProcessingSettings::default(),
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
    fn raw_preview_levels_average_the_complete_source_region() {
        let d = RawDescriptor {
            width: 64,
            height: 64,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Mono,
            ..RawDescriptor::default()
        };
        let bytes = (0..d.height)
            .flat_map(|y| (0..d.width).map(move |x| if (x + y) & 1 == 0 { 0 } else { 255 }))
            .collect::<Vec<_>>();
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        let request = TileRequest {
            generation: 1,
            frame: 0,
            level: 1,
            tile_x: 0,
            tile_y: 0,
            tile_size: 64,
            mode: DisplayMode::Raw,
            processing: ProcessingSettings::default(),
            display_min: 0,
            display_max: 255,
        };
        let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
        assert_eq!(&tile[0..4], &[128, 128, 128, 255]);
    }

    #[test]
    fn bayer_preview_levels_preserve_all_cfa_channels() {
        let d = RawDescriptor {
            width: 64,
            height: 64,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Rggb,
            ..RawDescriptor::default()
        };
        let bytes = (0..d.height)
            .flat_map(|y| {
                (0..d.width).map(move |x| {
                    match cfa_channel_with_phase(d.cfa, d.cfa_phase_x, d.cfa_phase_y, x, y) {
                        CfaChannel::Red => 200,
                        CfaChannel::Green => 100,
                        CfaChannel::Blue => 50,
                        CfaChannel::Mono => unreachable!(),
                    }
                })
            })
            .collect::<Vec<_>>();
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        for level in [1, 2, 3] {
            let request = TileRequest {
                generation: 1,
                frame: 0,
                level,
                tile_x: 0,
                tile_y: 0,
                tile_size: 64,
                mode: DisplayMode::Bayer,
                processing: ProcessingSettings::default(),
                display_min: 0,
                display_max: 255,
            };
            let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
            assert_eq!(&tile[0..4], &[200, 100, 50, 255], "level {level}");
        }
    }

    #[test]
    fn demosaic_preview_keeps_flat_color_stable_between_levels() {
        let d = RawDescriptor {
            width: 64,
            height: 64,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Rggb,
            ..RawDescriptor::default()
        };
        let bytes = (0..d.height)
            .flat_map(|y| {
                (0..d.width).map(move |x| {
                    match cfa_channel_with_phase(d.cfa, d.cfa_phase_x, d.cfa_phase_y, x, y) {
                        CfaChannel::Red => 200,
                        CfaChannel::Green => 100,
                        CfaChannel::Blue => 50,
                        CfaChannel::Mono => unreachable!(),
                    }
                })
            })
            .collect::<Vec<_>>();
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        let render = |level| {
            render_tile(
                &bytes,
                &d,
                &layout,
                &TileRequest {
                    generation: 1,
                    frame: 0,
                    level,
                    tile_x: 0,
                    tile_y: 0,
                    tile_size: 64,
                    mode: DisplayMode::Demosaic,
                    processing: ProcessingSettings::default(),
                    display_min: 0,
                    display_max: 255,
                },
            )
            .unwrap()
        };
        assert_eq!(&render(0)[0..4], &[200, 100, 50, 255]);
        assert_eq!(&render(1)[0..4], &[200, 100, 50, 255]);
        assert_eq!(&render(2)[0..4], &[200, 100, 50, 255]);
    }

    #[test]
    fn tile_rendering_can_be_cancelled_between_output_rows() {
        let d = RawDescriptor {
            width: 64,
            height: 64,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Mono,
            ..RawDescriptor::default()
        };
        let bytes = vec![128; 64 * 64];
        let (layout, _) = calculate_layout(&d, bytes.len() as u64);
        let request = TileRequest {
            generation: 1,
            frame: 0,
            level: 1,
            tile_x: 0,
            tile_y: 0,
            tile_size: 64,
            mode: DisplayMode::Raw,
            processing: ProcessingSettings::default(),
            display_min: 0,
            display_max: 255,
        };
        let result = render_tile_cancellable(&bytes, &d, &layout, &request, || false);
        assert_eq!(result.unwrap_err(), "stale_generation");
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
            processing: ProcessingSettings::default(),
            display_min: 0,
            display_max: 1023,
        };
        let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
        assert_eq!(tile.len(), 64 * 64 * 4);
        assert!(tile.chunks_exact(4).any(|pixel| pixel[3] == 255));
    }

    #[test]
    fn bayer_fill_classifies_green_sites_by_colored_row() {
        assert_eq!(bayer_site(CfaPattern::Mono, 1, 1), CfaSite::Mono);
        let expected = [
            (
                CfaPattern::Rggb,
                [
                    CfaSite::Red,
                    CfaSite::GreenRed,
                    CfaSite::GreenBlue,
                    CfaSite::Blue,
                ],
            ),
            (
                CfaPattern::Bggr,
                [
                    CfaSite::Blue,
                    CfaSite::GreenBlue,
                    CfaSite::GreenRed,
                    CfaSite::Red,
                ],
            ),
            (
                CfaPattern::Gbrg,
                [
                    CfaSite::GreenBlue,
                    CfaSite::Blue,
                    CfaSite::Red,
                    CfaSite::GreenRed,
                ],
            ),
            (
                CfaPattern::Grbg,
                [
                    CfaSite::GreenRed,
                    CfaSite::Red,
                    CfaSite::Blue,
                    CfaSite::GreenBlue,
                ],
            ),
        ];
        for (pattern, sites) in expected {
            assert_eq!(bayer_site(pattern, 0, 0), sites[0]);
            assert_eq!(bayer_site(pattern, 1, 0), sites[1]);
            assert_eq!(bayer_site(pattern, 0, 1), sites[2]);
            assert_eq!(bayer_site(pattern, 1, 1), sites[3]);
        }
    }

    #[test]
    fn quad_cfa_uses_four_by_four_sites_and_phase_offsets() {
        let mut descriptor = RawDescriptor {
            width: 4,
            height: 4,
            cfa: CfaPattern::Qrggb,
            ..RawDescriptor::default()
        };
        let expected = [
            [
                CfaSite::Red,
                CfaSite::Red,
                CfaSite::GreenRed,
                CfaSite::GreenRed,
            ],
            [
                CfaSite::Red,
                CfaSite::Red,
                CfaSite::GreenRed,
                CfaSite::GreenRed,
            ],
            [
                CfaSite::GreenBlue,
                CfaSite::GreenBlue,
                CfaSite::Blue,
                CfaSite::Blue,
            ],
            [
                CfaSite::GreenBlue,
                CfaSite::GreenBlue,
                CfaSite::Blue,
                CfaSite::Blue,
            ],
        ];
        for y in 0..4 {
            for x in 0..4 {
                assert_eq!(
                    cfa_site(&descriptor, x, y),
                    expected[y as usize][x as usize]
                );
            }
        }
        descriptor.cfa_phase_x = 1;
        assert_eq!(cfa_site(&descriptor, 0, 0), CfaSite::Red);
        assert_eq!(cfa_site(&descriptor, 1, 0), CfaSite::GreenRed);
        descriptor.cfa_phase_y = 2;
        assert_eq!(cfa_site(&descriptor, 0, 0), CfaSite::GreenBlue);
    }

    #[test]
    fn quad_reorder_is_a_reversible_four_by_four_permutation() {
        let descriptor = RawDescriptor {
            width: 4,
            height: 4,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Qrggb,
            ..RawDescriptor::default()
        };
        let bytes: Vec<u8> = (0..16).collect();
        let (layout, _) = calculate_layout(&descriptor, bytes.len() as u64);
        let expected = [[0, 2, 1, 3], [8, 10, 9, 11], [4, 6, 5, 7], [12, 14, 13, 15]];
        for y in 0..4 {
            for x in 0..4 {
                assert_eq!(
                    remosaic_pixel(
                        &bytes,
                        &descriptor,
                        &layout,
                        0,
                        x,
                        y,
                        RemosaicOptions {
                            same_color_reconstruction: false,
                        },
                    ),
                    Some(expected[y as usize][x as usize]),
                );
            }
        }
    }

    #[test]
    fn same_site_reconstruction_preserves_flat_quad_channels() {
        let descriptor = RawDescriptor {
            width: 8,
            height: 8,
            bit_depth: 10,
            packing: Packing::Unpacked16,
            cfa: CfaPattern::Qrggb,
            ..RawDescriptor::default()
        };
        let mut bytes = Vec::new();
        for y in 0..descriptor.height {
            for x in 0..descriptor.width {
                let value: u16 = match cfa_site(&descriptor, x, y) {
                    CfaSite::Red => 100,
                    CfaSite::GreenRed => 200,
                    CfaSite::GreenBlue => 300,
                    CfaSite::Blue => 400,
                    CfaSite::Mono => unreachable!(),
                };
                bytes.extend_from_slice(&value.to_le_bytes());
            }
        }
        let (layout, _) = calculate_layout(&descriptor, bytes.len() as u64);
        for y in 0..descriptor.height {
            for x in 0..descriptor.width {
                let expected = match remosaic_output_site(&descriptor, x, y) {
                    CfaSite::Red => 100,
                    CfaSite::GreenRed => 200,
                    CfaSite::GreenBlue => 300,
                    CfaSite::Blue => 400,
                    CfaSite::Mono => unreachable!(),
                };
                assert_eq!(
                    remosaic_pixel(
                        &bytes,
                        &descriptor,
                        &layout,
                        0,
                        x,
                        y,
                        RemosaicOptions {
                            same_color_reconstruction: true,
                        },
                    ),
                    Some(expected),
                );
            }
        }
    }

    #[test]
    fn missing_fill_respects_output_bit_depth() {
        let fill = MissingPixelFill {
            mono: 256,
            red: 1,
            green_blue: 2,
            green_red: 3,
            blue: 4,
        };
        let mono = RawDescriptor {
            cfa: CfaPattern::Mono,
            ..RawDescriptor::default()
        };
        let bayer = RawDescriptor::default();
        assert!(fill.validate(&mono, 255).is_err());
        assert!(fill.validate(&bayer, 255).is_ok());
    }

    #[test]
    fn export_uses_per_site_output_dn_for_missing_pixels() {
        let descriptor = RawDescriptor {
            width: 2,
            height: 2,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Rggb,
            ..RawDescriptor::default()
        };
        let source = [9u8];
        let layout = calculate_layout(&descriptor, source.len() as u64).0;
        let output = sibling_path(
            &std::env::temp_dir().join("eraw-export-fill-test.raw"),
            "test",
        );
        let request = ExportRequest {
            path: output.to_string_lossy().into_owned(),
            source_path: "source.raw".into(),
            source_generation: 1,
            source_descriptor: descriptor.clone(),
            target: ExportTarget::OriginalCfa,
            processing: ProcessingSettings::default(),
            current_frame: 0,
            crop_x: 0,
            crop_y: 0,
            crop_width: 2,
            crop_height: 2,
            packing: Packing::Unpacked8,
            bit_depth: 8,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            row_alignment: 1,
            frame_alignment: 1,
            value_mapping: ValueMapping::ScaleFullRange,
            missing_pixel_fill: MissingPixelFill {
                mono: 1,
                red: 10,
                green_blue: 30,
                green_red: 20,
                blue: 40,
            },
        };
        let result = export_raw(&source, &descriptor, &layout, &request).unwrap();
        let exported = fs::read(&output).unwrap();
        fs::remove_file(&output).unwrap();

        assert_eq!(exported, [9, 20, 30, 40]);
        assert_eq!(result.bytes_written, 4);
        assert_eq!(result.filled_pixels.red, 0);
        assert_eq!(result.filled_pixels.green_red, 1);
        assert_eq!(result.filled_pixels.green_blue, 1);
        assert_eq!(result.filled_pixels.blue, 1);
        assert_eq!(result.output_cfa, Some(CfaPattern::Rggb));
    }

    #[test]
    fn original_quad_export_updates_phase_after_crop() {
        let descriptor = RawDescriptor {
            width: 4,
            height: 4,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Qrggb,
            cfa_phase_x: 1,
            cfa_phase_y: 2,
            ..RawDescriptor::default()
        };
        let source: Vec<u8> = (0..16).collect();
        let layout = calculate_layout(&descriptor, source.len() as u64).0;
        let output = sibling_path(
            &std::env::temp_dir().join("eraw-export-quad-phase.raw"),
            "test",
        );
        let mut request = test_export_request(&descriptor, &output, ExportTarget::OriginalCfa);
        request.crop_x = 1;
        request.crop_y = 1;
        request.crop_width = 2;
        request.crop_height = 2;

        let result = export_raw(&source, &descriptor, &layout, &request).unwrap();
        let exported = fs::read(&output).unwrap();
        fs::remove_file(&output).unwrap();

        assert_eq!(exported, [5, 6, 9, 10]);
        assert_eq!(result.output_cfa, Some(CfaPattern::Qrggb));
        assert_eq!(result.output_cfa_phase_x, 2);
        assert_eq!(result.output_cfa_phase_y, 3);
        assert_eq!(result.output_channels, 1);
    }

    #[test]
    fn remosaic_export_writes_reordered_bayer_bytes() {
        let descriptor = RawDescriptor {
            width: 4,
            height: 4,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Qrggb,
            ..RawDescriptor::default()
        };
        let source: Vec<u8> = (0..16).collect();
        let layout = calculate_layout(&descriptor, source.len() as u64).0;
        let output = sibling_path(
            &std::env::temp_dir().join("eraw-export-remosaic-reorder.raw"),
            "test",
        );
        let request = test_export_request(&descriptor, &output, ExportTarget::Remosaic);

        let result = export_raw(&source, &descriptor, &layout, &request).unwrap();
        let exported = fs::read(&output).unwrap();
        fs::remove_file(&output).unwrap();

        assert_eq!(
            exported,
            [0, 2, 1, 3, 8, 10, 9, 11, 4, 6, 5, 7, 12, 14, 13, 15]
        );
        assert_eq!(result.output_cfa, Some(CfaPattern::Rggb));
        assert_eq!(result.output_cfa_phase_x, 0);
        assert_eq!(result.output_cfa_phase_y, 0);
    }

    #[test]
    fn remosaic_export_reports_bayer_phase_after_source_phase_and_crop() {
        let descriptor = RawDescriptor {
            width: 8,
            height: 8,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Qrggb,
            cfa_phase_x: 1,
            cfa_phase_y: 2,
            ..RawDescriptor::default()
        };
        let source = vec![0; 64];
        let layout = calculate_layout(&descriptor, source.len() as u64).0;
        let output = sibling_path(
            &std::env::temp_dir().join("eraw-export-remosaic-phase.raw"),
            "test",
        );
        let mut request = test_export_request(&descriptor, &output, ExportTarget::Remosaic);
        request.crop_x = 1;
        request.crop_y = 1;
        request.crop_width = 4;
        request.crop_height = 4;

        let result = export_raw(&source, &descriptor, &layout, &request).unwrap();
        fs::remove_file(&output).unwrap();

        assert_eq!(result.output_cfa, Some(CfaPattern::Gbrg));
        assert_eq!(result.output_cfa_phase_x, 0);
        assert_eq!(result.output_cfa_phase_y, 0);
    }

    #[test]
    fn reconstructed_remosaic_export_preserves_flat_quad_channels() {
        let descriptor = RawDescriptor {
            width: 8,
            height: 8,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Qbggr,
            ..RawDescriptor::default()
        };
        let mut source = Vec::new();
        for y in 0..descriptor.height {
            for x in 0..descriptor.width {
                source.push(match cfa_site(&descriptor, x, y) {
                    CfaSite::Red => 40,
                    CfaSite::GreenRed => 30,
                    CfaSite::GreenBlue => 20,
                    CfaSite::Blue => 10,
                    CfaSite::Mono => unreachable!(),
                });
            }
        }
        let layout = calculate_layout(&descriptor, source.len() as u64).0;
        let output = sibling_path(
            &std::env::temp_dir().join("eraw-export-remosaic-reconstruct.raw"),
            "test",
        );
        let mut request = test_export_request(&descriptor, &output, ExportTarget::Remosaic);
        request.processing.remosaic.same_color_reconstruction = true;

        let result = export_raw(&source, &descriptor, &layout, &request).unwrap();
        let exported = fs::read(&output).unwrap();
        fs::remove_file(&output).unwrap();

        for y in 0..descriptor.height {
            for x in 0..descriptor.width {
                let expected = match remosaic_output_site(&descriptor, x, y) {
                    CfaSite::Red => 40,
                    CfaSite::GreenRed => 30,
                    CfaSite::GreenBlue => 20,
                    CfaSite::Blue => 10,
                    CfaSite::Mono => unreachable!(),
                };
                assert_eq!(exported[(y * descriptor.width + x) as usize], expected);
            }
        }
        assert_eq!(result.filled_pixels.red, 0);
        assert_eq!(result.output_cfa, Some(CfaPattern::Bggr));
    }

    #[test]
    fn demosaic_export_writes_rgb48_in_selected_endianness() {
        let descriptor = RawDescriptor {
            width: 2,
            height: 2,
            bit_depth: 10,
            packing: Packing::Unpacked16,
            cfa: CfaPattern::Rggb,
            ..RawDescriptor::default()
        };
        let values = [10u16, 20, 30, 40];
        let source = values
            .iter()
            .flat_map(|value| value.to_le_bytes())
            .collect::<Vec<_>>();
        let layout = calculate_layout(&descriptor, source.len() as u64).0;
        let pixels = [[10u16, 25, 40], [10, 20, 40], [10, 30, 40], [10, 25, 40]];

        for endianness in [Endianness::Little, Endianness::Big] {
            let output = sibling_path(&std::env::temp_dir().join("eraw-export-rgb48.raw"), "test");
            let mut request = test_export_request(&descriptor, &output, ExportTarget::Demosaic);
            request.endianness = endianness;
            let result = export_raw(&source, &descriptor, &layout, &request).unwrap();
            let exported = fs::read(&output).unwrap();
            fs::remove_file(&output).unwrap();
            let expected = pixels
                .iter()
                .flatten()
                .flat_map(|value| match endianness {
                    Endianness::Little => value.to_le_bytes(),
                    Endianness::Big => value.to_be_bytes(),
                })
                .collect::<Vec<_>>();

            assert_eq!(exported, expected);
            assert_eq!(result.bytes_written, 24);
            assert_eq!(result.output_cfa, None);
            assert_eq!(result.output_channels, 3);
            assert_eq!(result.output_bit_depth, 10);
        }
    }

    #[test]
    fn quad_demosaic_export_uses_selected_remosaic_processing() {
        let descriptor = RawDescriptor {
            width: 8,
            height: 8,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Qrggb,
            ..RawDescriptor::default()
        };
        let mut source = Vec::new();
        for y in 0..descriptor.height {
            for x in 0..descriptor.width {
                source.push(match cfa_channel(&descriptor, x, y) {
                    CfaChannel::Red => 100,
                    CfaChannel::Green => 50,
                    CfaChannel::Blue => 20,
                    CfaChannel::Mono => unreachable!(),
                });
            }
        }
        let layout = calculate_layout(&descriptor, source.len() as u64).0;
        let output = sibling_path(
            &std::env::temp_dir().join("eraw-export-quad-rgb48.raw"),
            "test",
        );
        let mut request = test_export_request(&descriptor, &output, ExportTarget::Demosaic);
        request.processing.remosaic.same_color_reconstruction = true;

        let result = export_raw(&source, &descriptor, &layout, &request).unwrap();
        let exported = fs::read(&output).unwrap();
        fs::remove_file(&output).unwrap();

        assert_eq!(result.filled_pixels.rgb, 0);
        for pixel in exported.chunks_exact(6) {
            assert_eq!(u16::from_le_bytes([pixel[0], pixel[1]]), 100);
            assert_eq!(u16::from_le_bytes([pixel[2], pixel[3]]), 50);
            assert_eq!(u16::from_le_bytes([pixel[4], pixel[5]]), 20);
        }
    }

    #[test]
    fn demosaic_export_rejects_mono_and_fills_incomplete_color_pixels() {
        let mono = RawDescriptor {
            width: 1,
            height: 1,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Mono,
            ..RawDescriptor::default()
        };
        let mono_layout = calculate_layout(&mono, 1).0;
        let mono_output = sibling_path(
            &std::env::temp_dir().join("eraw-export-mono-rgb.raw"),
            "test",
        );
        let mono_request = test_export_request(&mono, &mono_output, ExportTarget::Demosaic);
        assert!(export_raw(&[7], &mono, &mono_layout, &mono_request).is_err());

        let color = RawDescriptor {
            width: 2,
            height: 2,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            cfa: CfaPattern::Rggb,
            ..RawDescriptor::default()
        };
        let source = [9u8];
        let layout = calculate_layout(&color, source.len() as u64).0;
        let output = sibling_path(
            &std::env::temp_dir().join("eraw-export-partial-rgb.raw"),
            "test",
        );
        let mut request = test_export_request(&color, &output, ExportTarget::Demosaic);
        request.missing_pixel_fill = MissingPixelFill {
            mono: 0,
            red: 11,
            green_blue: 22,
            green_red: 32,
            blue: 44,
        };
        let result = export_raw(&source, &color, &layout, &request).unwrap();
        let exported = fs::read(&output).unwrap();
        fs::remove_file(&output).unwrap();

        assert_eq!(exported.len(), 24);
        assert!(result.filled_pixels.rgb > 0);
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
            processing: ProcessingSettings::default(),
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
            processing: ProcessingSettings::default(),
        };
        let error = inspect_pixels(&[], &d, &layout, &request).unwrap_err();
        assert!(error.contains("区域过大"));
    }
}
