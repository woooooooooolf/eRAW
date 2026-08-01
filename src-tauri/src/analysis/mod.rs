use crate::raw::{
    CfaPattern, CfaSite, Packing, RawDescriptor, RawLayout, cfa_atomic_position, cfa_period,
    cfa_site_with_phase, read_pixel,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRequest {
    pub generation: u64,
    pub analysis_revision: u64,
    pub frame: u64,
    pub roi: Option<AnalysisRect>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisSnapshot {
    pub generation: u64,
    pub analysis_revision: u64,
    pub frame: u64,
    pub roi: AnalysisRect,
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub packing: Packing,
    pub cfa: CfaPattern,
    pub cfa_phase_x: u8,
    pub cfa_phase_y: u8,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatisticalSummary {
    pub expected_count: u64,
    pub valid_count: u64,
    pub missing_count: u64,
    pub minimum: Option<u16>,
    pub maximum: Option<u16>,
    pub mean: Option<f64>,
    pub median: Option<u16>,
    pub mode: Option<u16>,
    pub variance: Option<f64>,
    pub standard_deviation: Option<f64>,
    pub p1: Option<u16>,
    pub p5: Option<u16>,
    pub p95: Option<u16>,
    pub p99: Option<u16>,
    pub zero_count: u64,
    pub full_scale_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePoint {
    pub coordinate: u32,
    pub expected_count: u64,
    pub valid_count: u64,
    pub missing_count: u64,
    pub mean: Option<f64>,
    pub standard_deviation: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupStatistics {
    pub key: &'static str,
    pub summary: StatisticalSummary,
    pub histogram: Vec<u64>,
    pub row_profile: Vec<ProfilePoint>,
    pub column_profile: Vec<ProfilePoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AtomicPlaneStatistics {
    pub key: String,
    pub phase_x: u8,
    pub phase_y: u8,
    pub semantic: &'static str,
    pub summary: StatisticalSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub snapshot: AnalysisSnapshot,
    pub groups: Vec<GroupStatistics>,
    pub atomic_planes: Vec<AtomicPlaneStatistics>,
}

#[derive(Debug, Clone)]
struct RunningMoments {
    expected: u64,
    valid: u64,
    mean: f64,
    m2: f64,
}

impl Default for RunningMoments {
    fn default() -> Self {
        Self {
            expected: 0,
            valid: 0,
            mean: 0.0,
            m2: 0.0,
        }
    }
}

impl RunningMoments {
    fn expect(&mut self) {
        self.expected += 1;
    }

    fn push(&mut self, value: u16) {
        self.valid += 1;
        let delta = f64::from(value) - self.mean;
        self.mean += delta / self.valid as f64;
        let delta_after = f64::from(value) - self.mean;
        self.m2 += delta * delta_after;
    }

    fn variance(&self) -> Option<f64> {
        (self.valid > 0).then(|| self.m2 / self.valid as f64)
    }
}

#[derive(Debug, Clone)]
struct Accumulator {
    moments: RunningMoments,
    histogram: Vec<u64>,
}

impl Accumulator {
    fn new(bin_count: usize) -> Self {
        Self {
            moments: RunningMoments::default(),
            histogram: vec![0; bin_count],
        }
    }

    fn expect(&mut self) {
        self.moments.expect();
    }

    fn push(&mut self, value: u16) {
        self.moments.push(value);
        self.histogram[usize::from(value)] += 1;
    }

    fn summary(&self) -> StatisticalSummary {
        summary_from(&self.moments, &self.histogram)
    }
}

fn percentile(histogram: &[u64], valid: u64, percentile: u64) -> Option<u16> {
    if valid == 0 {
        return None;
    }
    let rank = ((valid - 1) * percentile) / 100;
    let mut cumulative = 0u64;
    histogram.iter().enumerate().find_map(|(value, count)| {
        cumulative += count;
        (cumulative > rank).then_some(value as u16)
    })
}

fn summary_from(moments: &RunningMoments, histogram: &[u64]) -> StatisticalSummary {
    let minimum = histogram
        .iter()
        .position(|count| *count > 0)
        .map(|value| value as u16);
    let maximum = histogram
        .iter()
        .rposition(|count| *count > 0)
        .map(|value| value as u16);
    let mode = histogram
        .iter()
        .enumerate()
        .max_by_key(|(value, count)| (**count, std::cmp::Reverse(*value)))
        .and_then(|(value, count)| (*count > 0).then_some(value as u16));
    let variance = moments.variance();
    StatisticalSummary {
        expected_count: moments.expected,
        valid_count: moments.valid,
        missing_count: moments.expected.saturating_sub(moments.valid),
        minimum,
        maximum,
        mean: (moments.valid > 0).then_some(moments.mean),
        median: percentile(histogram, moments.valid, 50),
        mode,
        variance,
        standard_deviation: variance.map(f64::sqrt),
        p1: percentile(histogram, moments.valid, 1),
        p5: percentile(histogram, moments.valid, 5),
        p95: percentile(histogram, moments.valid, 95),
        p99: percentile(histogram, moments.valid, 99),
        zero_count: histogram.first().copied().unwrap_or(0),
        full_scale_count: histogram.last().copied().unwrap_or(0),
    }
}

fn site_name(site: CfaSite) -> &'static str {
    match site {
        CfaSite::Mono => "Y",
        CfaSite::Red => "R",
        CfaSite::GreenRed => "Gr",
        CfaSite::GreenBlue => "Gb",
        CfaSite::Blue => "B",
    }
}

fn group_keys(cfa: CfaPattern) -> &'static [&'static str] {
    if cfa == CfaPattern::Mono {
        &["all", "Y"]
    } else {
        &["all", "R", "G", "Gr", "Gb", "B"]
    }
}

fn group_indices(site: CfaSite) -> &'static [usize] {
    match site {
        CfaSite::Mono => &[0, 1],
        CfaSite::Red => &[0, 1],
        CfaSite::GreenRed => &[0, 2, 3],
        CfaSite::GreenBlue => &[0, 2, 4],
        CfaSite::Blue => &[0, 5],
    }
}

fn validated_roi(
    descriptor: &RawDescriptor,
    roi: Option<AnalysisRect>,
) -> Result<AnalysisRect, String> {
    let roi = roi.unwrap_or(AnalysisRect {
        x: 0,
        y: 0,
        width: descriptor.width,
        height: descriptor.height,
    });
    if roi.width == 0 || roi.height == 0 {
        return Err("analysis_invalid_roi".into());
    }
    let right = roi.x.checked_add(roi.width).ok_or("analysis_invalid_roi")?;
    let bottom = roi
        .y
        .checked_add(roi.height)
        .ok_or("analysis_invalid_roi")?;
    if right > descriptor.width || bottom > descriptor.height {
        return Err("analysis_invalid_roi".into());
    }
    Ok(roi)
}

fn profile_point(coordinate: u32, moments: &RunningMoments) -> ProfilePoint {
    ProfilePoint {
        coordinate,
        expected_count: moments.expected,
        valid_count: moments.valid,
        missing_count: moments.expected.saturating_sub(moments.valid),
        mean: (moments.valid > 0).then_some(moments.mean),
        standard_deviation: moments.variance().map(f64::sqrt),
    }
}

pub fn analyze_image(
    data: &[u8],
    descriptor: &RawDescriptor,
    layout: &RawLayout,
    request: &AnalysisRequest,
    should_continue: impl Fn() -> bool,
) -> Result<AnalysisResult, String> {
    if request.frame >= layout.frame_count {
        return Err("analysis_invalid_frame".into());
    }
    let roi = validated_roi(descriptor, request.roi)?;
    let bin_count = 1usize << descriptor.bit_depth.min(16);
    let keys = group_keys(descriptor.cfa);
    let mut groups = keys
        .iter()
        .map(|_| Accumulator::new(bin_count))
        .collect::<Vec<_>>();
    let mut row_profiles = keys
        .iter()
        .map(|_| vec![RunningMoments::default(); roi.height as usize])
        .collect::<Vec<_>>();
    let mut column_profiles = keys
        .iter()
        .map(|_| vec![RunningMoments::default(); roi.width as usize])
        .collect::<Vec<_>>();
    let period = cfa_period(descriptor.cfa);
    let period_usize = period as usize;
    let mut atoms = (0..period_usize * period_usize)
        .map(|_| Accumulator::new(bin_count))
        .collect::<Vec<_>>();

    for (row_index, y) in (roi.y..roi.y + roi.height).enumerate() {
        if row_index % 32 == 0 && !should_continue() {
            return Err("stale_analysis".into());
        }
        for (column_index, x) in (roi.x..roi.x + roi.width).enumerate() {
            let site = cfa_site_with_phase(
                descriptor.cfa,
                descriptor.cfa_phase_x,
                descriptor.cfa_phase_y,
                x,
                y,
            );
            let atomic_position = cfa_atomic_position(descriptor, x, y);
            let value = read_pixel(data, descriptor, layout, request.frame, x, y);
            for &group_index in group_indices(site) {
                let group = &mut groups[group_index];
                let row = &mut row_profiles[group_index][row_index];
                let column = &mut column_profiles[group_index][column_index];
                group.expect();
                row.expect();
                column.expect();
                if let Some(value) = value {
                    group.push(value);
                    row.push(value);
                    column.push(value);
                }
            }
            let atom_index =
                usize::from(atomic_position.0) * period_usize + usize::from(atomic_position.1);
            let atom = &mut atoms[atom_index];
            atom.expect();
            if let Some(value) = value {
                atom.push(value);
            }
        }
    }
    if !should_continue() {
        return Err("stale_analysis".into());
    }

    let group_results = keys
        .iter()
        .copied()
        .zip(groups)
        .zip(row_profiles)
        .zip(column_profiles)
        .map(|(((key, accumulator), rows), columns)| GroupStatistics {
            key,
            summary: accumulator.summary(),
            histogram: accumulator.histogram,
            row_profile: rows
                .iter()
                .enumerate()
                .map(|(index, moments)| profile_point(roi.y + index as u32, moments))
                .collect(),
            column_profile: columns
                .iter()
                .enumerate()
                .map(|(index, moments)| profile_point(roi.x + index as u32, moments))
                .collect(),
        })
        .collect();
    let atomic_planes = atoms
        .into_iter()
        .enumerate()
        .map(|(index, accumulator)| {
            let phase_x = (index / period_usize) as u8;
            let phase_y = (index % period_usize) as u8;
            let site = cfa_site_with_phase(
                descriptor.cfa,
                descriptor.cfa_phase_x,
                descriptor.cfa_phase_y,
                u32::from(
                    phase_x.wrapping_sub(descriptor.cfa_phase_x % period as u8) % period as u8,
                ),
                u32::from(
                    phase_y.wrapping_sub(descriptor.cfa_phase_y % period as u8) % period as u8,
                ),
            );
            AtomicPlaneStatistics {
                key: format!("p{phase_x}{phase_y}"),
                phase_x,
                phase_y,
                semantic: site_name(site),
                summary: accumulator.summary(),
            }
        })
        .collect();

    Ok(AnalysisResult {
        snapshot: AnalysisSnapshot {
            generation: request.generation,
            analysis_revision: request.analysis_revision,
            frame: request.frame,
            roi,
            width: descriptor.width,
            height: descriptor.height,
            bit_depth: descriptor.bit_depth,
            packing: descriptor.packing,
            cfa: descriptor.cfa,
            cfa_phase_x: descriptor.cfa_phase_x,
            cfa_phase_y: descriptor.cfa_phase_y,
        },
        groups: group_results,
        atomic_planes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::raw::{BitAlignment, Endianness, Packing, calculate_layout};

    fn descriptor(width: u32, height: u32, cfa: CfaPattern) -> RawDescriptor {
        RawDescriptor {
            width,
            height,
            bit_depth: 8,
            packing: Packing::Unpacked8,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            cfa,
            ..RawDescriptor::default()
        }
    }

    fn analyze(
        data: &[u8],
        descriptor: &RawDescriptor,
        roi: Option<AnalysisRect>,
    ) -> AnalysisResult {
        let (layout, _) = calculate_layout(descriptor, data.len() as u64);
        analyze_image(
            data,
            descriptor,
            &layout,
            &AnalysisRequest {
                generation: 1,
                analysis_revision: 1,
                frame: 0,
                roi,
            },
            || true,
        )
        .unwrap()
    }

    #[test]
    fn mono_summary_histogram_and_population_variance_are_exact() {
        let descriptor = descriptor(3, 2, CfaPattern::Mono);
        let result = analyze(&[0, 1, 1, 2, 4, 255], &descriptor, None);
        let all = &result.groups[0];
        assert_eq!(all.summary.expected_count, 6);
        assert_eq!(all.summary.valid_count, 6);
        assert_eq!(all.summary.minimum, Some(0));
        assert_eq!(all.summary.maximum, Some(255));
        assert_eq!(all.summary.mean, Some(263.0 / 6.0));
        assert_eq!(all.summary.median, Some(1));
        assert_eq!(all.summary.mode, Some(1));
        assert!((all.summary.variance.unwrap() - 8919.805555555555).abs() < 1e-9);
        assert_eq!(all.summary.zero_count, 1);
        assert_eq!(all.summary.full_scale_count, 1);
        assert_eq!(all.histogram[1], 2);
    }

    #[test]
    fn missing_samples_are_counted_but_do_not_enter_statistics() {
        let descriptor = descriptor(4, 2, CfaPattern::Mono);
        let result = analyze(&[10, 20, 30], &descriptor, None);
        let all = &result.groups[0];
        assert_eq!(all.summary.expected_count, 8);
        assert_eq!(all.summary.valid_count, 3);
        assert_eq!(all.summary.missing_count, 5);
        assert_eq!(all.summary.mean, Some(20.0));
        assert_eq!(all.row_profile[1].valid_count, 0);
        assert_eq!(all.row_profile[1].mean, None);
    }

    #[test]
    fn roi_preserves_absolute_bayer_phase_and_profile_coordinates() {
        let descriptor = descriptor(4, 4, CfaPattern::Rggb);
        let data = (0..16).collect::<Vec<u8>>();
        let result = analyze(
            &data,
            &descriptor,
            Some(AnalysisRect {
                x: 1,
                y: 1,
                width: 2,
                height: 2,
            }),
        );
        let red = result.groups.iter().find(|group| group.key == "R").unwrap();
        let blue = result.groups.iter().find(|group| group.key == "B").unwrap();
        assert_eq!(red.summary.mean, Some(10.0));
        assert_eq!(blue.summary.mean, Some(5.0));
        assert_eq!(red.row_profile[0].coordinate, 1);
        assert_eq!(red.column_profile[0].coordinate, 1);
    }

    #[test]
    fn quad_cfa_keeps_sixteen_atomic_planes_and_merges_semantic_groups() {
        let descriptor = descriptor(4, 4, CfaPattern::Qrggb);
        let data = (0..16).collect::<Vec<u8>>();
        let result = analyze(&data, &descriptor, None);
        assert_eq!(result.atomic_planes.len(), 16);
        assert!(
            result
                .atomic_planes
                .iter()
                .all(|plane| plane.summary.valid_count == 1)
        );
        let red = result.groups.iter().find(|group| group.key == "R").unwrap();
        let green = result.groups.iter().find(|group| group.key == "G").unwrap();
        let blue = result.groups.iter().find(|group| group.key == "B").unwrap();
        assert_eq!(red.summary.valid_count, 4);
        assert_eq!(green.summary.valid_count, 8);
        assert_eq!(blue.summary.valid_count, 4);
        assert_eq!(
            red.summary.valid_count + green.summary.valid_count + blue.summary.valid_count,
            16
        );
    }

    #[test]
    fn cancellation_stops_analysis_cooperatively() {
        let descriptor = descriptor(64, 64, CfaPattern::Mono);
        let (layout, _) = calculate_layout(&descriptor, 4096);
        let error = analyze_image(
            &[0; 4096],
            &descriptor,
            &layout,
            &AnalysisRequest {
                generation: 1,
                analysis_revision: 1,
                frame: 0,
                roi: None,
            },
            || false,
        )
        .unwrap_err();
        assert_eq!(error, "stale_analysis");
    }
}
