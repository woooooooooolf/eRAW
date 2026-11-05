use super::*;
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

fn test_output_path(label: &str) -> PathBuf {
    static NEXT_ID: AtomicU64 = AtomicU64::new(1);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should follow the Unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "eraw-{label}-{}-{timestamp}-{}.raw",
        std::process::id(),
        NEXT_ID.fetch_add(1, Ordering::Relaxed)
    ))
}

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
fn output_bytes_create_and_safely_replace_files() {
    let output = test_output_path("output-bytes");
    write_output_bytes(&output, b"first").unwrap();
    assert_eq!(fs::read(&output).unwrap(), b"first");

    write_output_bytes(&output, b"replacement").unwrap();
    assert_eq!(fs::read(&output).unwrap(), b"replacement");
    fs::remove_file(&output).unwrap();
}

#[test]
fn cancelled_export_keeps_existing_output_and_reports_progress() {
    use std::cell::{Cell, RefCell};

    let descriptor = RawDescriptor {
        width: 4,
        height: 6,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Mono,
        ..RawDescriptor::default()
    };
    let source = vec![7; (descriptor.width * descriptor.height) as usize];
    let layout = calculate_layout(&descriptor, source.len() as u64).0;
    let output = test_output_path("cancelled-export");
    write_output_bytes(&output, b"existing").unwrap();
    let request = test_export_request(&descriptor, &output, ExportTarget::OriginalCfa);
    let checks = Cell::new(0u32);
    let progress = RefCell::new(Vec::new());

    let error = export_raw_cancellable(
        &source,
        &descriptor,
        &layout,
        &request,
        || {
            checks.set(checks.get() + 1);
            checks.get() <= 2
        },
        |completed, total| progress.borrow_mut().push((completed, total)),
    )
    .unwrap_err();

    assert_eq!(error, "export_cancelled");
    assert_eq!(fs::read(&output).unwrap(), b"existing");
    assert_eq!(*progress.borrow(), vec![(1, 6), (2, 6)]);
    fs::remove_file(&output).unwrap();
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
        render_revision: 1,
        frame: 0,
        level: 0,
        tile_x: 0,
        tile_y: 0,
        tile_size: 64,
        mode: DisplayMode::Raw,
        processing: ProcessingSettings::default(),
        display_window: DisplayWindow {
            black_point: 0,
            white_point: 255,
        },
    };
    let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
    assert_eq!(&tile[0..4], &[128, 128, 128, 255]);
    let missing = 40 * 4;
    assert_eq!(&tile[missing..missing + 4], &[0, 0, 0, 254]);
    let missing_later_row = (63 * 64 + 63) * 4;
    assert_eq!(
        &tile[missing_later_row..missing_later_row + 4],
        &[0, 0, 0, 254]
    );
    assert_eq!(tile.len(), 64 * 64 * 4);

    let smaller = RawDescriptor {
        width: 32,
        height: 32,
        ..d
    };
    let complete_bytes = vec![128u8; 32 * 32];
    let (smaller_layout, _) = calculate_layout(&smaller, complete_bytes.len() as u64);
    let smaller_tile =
        render_tile(&complete_bytes, &smaller, &smaller_layout, &request).unwrap();
    let outside_image = 32 * 4;
    assert_eq!(
        &smaller_tile[outside_image..outside_image + 4],
        &[0, 0, 0, 0]
    );
}

#[test]
fn tile_renderer_maps_explicit_display_window_before_preview_quantization() {
    let descriptor = RawDescriptor {
        width: 64,
        height: 1,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Mono,
        ..RawDescriptor::default()
    };
    let bytes = [0, 128, 255];
    let (layout, _) = calculate_layout(&descriptor, bytes.len() as u64);
    let request = TileRequest {
        generation: 1,
        render_revision: 1,
        frame: 0,
        level: 0,
        tile_x: 0,
        tile_y: 0,
        tile_size: 64,
        mode: DisplayMode::Raw,
        processing: ProcessingSettings::default(),
        display_window: DisplayWindow {
            black_point: 64,
            white_point: 192,
        },
    };
    for mode in [
        DisplayMode::Raw,
        DisplayMode::Bayer,
        DisplayMode::Remosaic,
        DisplayMode::Demosaic,
        DisplayMode::Red,
        DisplayMode::Green,
        DisplayMode::Blue,
    ] {
        let tile = render_tile(
            &bytes,
            &descriptor,
            &layout,
            &TileRequest {
                mode,
                ..request.clone()
            },
        )
        .unwrap();
        assert_eq!(&tile[0..4], &[0, 0, 0, 255]);
        assert_eq!(&tile[4..8], &[128, 128, 128, 255]);
        assert_eq!(&tile[8..12], &[255, 255, 255, 255]);
    }
}

#[test]
fn tile_renderer_rejects_invalid_display_window() {
    let descriptor = RawDescriptor {
        width: 64,
        height: 1,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Mono,
        ..RawDescriptor::default()
    };
    let bytes = [0; 64];
    let (layout, _) = calculate_layout(&descriptor, bytes.len() as u64);
    let request = TileRequest {
        generation: 1,
        render_revision: 1,
        frame: 0,
        level: 0,
        tile_x: 0,
        tile_y: 0,
        tile_size: 64,
        mode: DisplayMode::Raw,
        processing: ProcessingSettings::default(),
        display_window: DisplayWindow {
            black_point: 100,
            white_point: 100,
        },
    };
    assert_eq!(
        render_tile(&bytes, &descriptor, &layout, &request).unwrap_err(),
        "display_invalid_window"
    );
}

#[test]
fn all_display_modes_share_the_same_display_window() {
    let descriptor = RawDescriptor {
        bit_depth: 10,
        ..RawDescriptor::default()
    };
    let custom = DisplayWindow {
        black_point: 100,
        white_point: 900,
    };
    assert_eq!(
        resolve_display_window(&descriptor, &custom).unwrap(),
        (100, 900)
    );
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
        render_revision: 1,
        frame: 0,
        level: 1,
        tile_x: 0,
        tile_y: 0,
        tile_size: 64,
        mode: DisplayMode::Raw,
        processing: ProcessingSettings::default(),
        display_window: DisplayWindow {
            black_point: 0,
            white_point: 255,
        },
    };
    let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
    assert_eq!(&tile[0..4], &[128, 128, 128, 255]);
}

#[test]
fn bayer_preview_levels_preserve_cfa_sites_instead_of_mixing_channels() {
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
    for level in [1, 2, 3, 4] {
        let request = TileRequest {
            generation: 1,
            render_revision: 1,
            frame: 0,
            level,
            tile_x: 0,
            tile_y: 0,
            tile_size: 64,
            mode: DisplayMode::Bayer,
            processing: ProcessingSettings::default(),
            display_window: DisplayWindow {
                black_point: 0,
                white_point: 255,
            },
        };
        let tile = render_tile(&bytes, &d, &layout, &request).unwrap();
        let pixel = |x: usize, y: usize| {
            let index = (y * 64 + x) * 4;
            &tile[index..index + 4]
        };
        assert_eq!(pixel(0, 0), &[200, 0, 0, 255], "level {level}");
        assert_eq!(pixel(1, 0), &[0, 100, 0, 255], "level {level}");
        assert_eq!(pixel(0, 1), &[0, 100, 0, 255], "level {level}");
        assert_eq!(pixel(1, 1), &[0, 0, 50, 255], "level {level}");
    }
}

#[test]
fn quad_preview_levels_reduce_same_color_blocks_to_a_bayer_mosaic() {
    let d = RawDescriptor {
        width: 64,
        height: 64,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Qrggb,
        ..RawDescriptor::default()
    };
    let mut bytes = Vec::with_capacity((d.width * d.height) as usize);
    for y in 0..d.height {
        for x in 0..d.width {
            bytes.push(match cfa_site(&d, x, y) {
                CfaSite::Red => 220,
                CfaSite::GreenRed => 140,
                CfaSite::GreenBlue => 90,
                CfaSite::Blue => 40,
                CfaSite::Mono => unreachable!(),
            });
        }
    }
    let (layout, _) = calculate_layout(&d, bytes.len() as u64);
    for (mode, expected) in [
        (
            DisplayMode::Raw,
            [
                [220, 220, 220, 255],
                [140, 140, 140, 255],
                [90, 90, 90, 255],
                [40, 40, 40, 255],
            ],
        ),
        (
            DisplayMode::Bayer,
            [
                [220, 0, 0, 255],
                [0, 140, 0, 255],
                [0, 90, 0, 255],
                [0, 0, 40, 255],
            ],
        ),
    ] {
        for level in [1, 2, 3, 4] {
            let tile = render_tile(
                &bytes,
                &d,
                &layout,
                &TileRequest {
                    generation: 1,
                    render_revision: 1,
                    frame: 0,
                    level,
                    tile_x: 0,
                    tile_y: 0,
                    tile_size: 64,
                    mode,
                    processing: ProcessingSettings::default(),
                    display_window: DisplayWindow {
                        black_point: 0,
                        white_point: 255,
                    },
                },
            )
            .unwrap();
            let pixel = |x: usize, y: usize| {
                let index = (y * 64 + x) * 4;
                &tile[index..index + 4]
            };
            assert_eq!(pixel(0, 0), expected[0], "mode {mode:?}, level {level}");
            assert_eq!(pixel(1, 0), expected[1], "mode {mode:?}, level {level}");
            assert_eq!(pixel(0, 1), expected[2], "mode {mode:?}, level {level}");
            assert_eq!(pixel(1, 1), expected[3], "mode {mode:?}, level {level}");
        }
    }
}

#[test]
fn remosaic_preview_levels_keep_the_processed_bayer_mosaic() {
    let d = RawDescriptor {
        width: 64,
        height: 64,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Qrggb,
        ..RawDescriptor::default()
    };
    let mut bytes = Vec::with_capacity((d.width * d.height) as usize);
    for y in 0..d.height {
        for x in 0..d.width {
            bytes.push(match cfa_site(&d, x, y) {
                CfaSite::Red => 220,
                CfaSite::GreenRed => 140,
                CfaSite::GreenBlue => 90,
                CfaSite::Blue => 40,
                CfaSite::Mono => unreachable!(),
            });
        }
    }
    let (layout, _) = calculate_layout(&d, bytes.len() as u64);
    for level in [1, 2, 3, 4] {
        let tile = render_tile(
            &bytes,
            &d,
            &layout,
            &TileRequest {
                generation: 1,
                render_revision: 1,
                frame: 0,
                level,
                tile_x: 0,
                tile_y: 0,
                tile_size: 64,
                mode: DisplayMode::Remosaic,
                processing: ProcessingSettings::default(),
                display_window: DisplayWindow {
                    black_point: 0,
                    white_point: 255,
                },
            },
        )
        .unwrap();
        let pixel = |x: usize, y: usize| {
            let index = (y * 64 + x) * 4;
            &tile[index..index + 4]
        };
        assert_eq!(pixel(0, 0), &[220, 0, 0, 255], "level {level}");
        assert_eq!(pixel(1, 0), &[0, 140, 0, 255], "level {level}");
        assert_eq!(pixel(0, 1), &[0, 90, 0, 255], "level {level}");
        assert_eq!(pixel(1, 1), &[0, 0, 40, 255], "level {level}");
    }
}

#[test]
fn structural_quad_lod_collapses_phase_without_losing_site_order() {
    for phase_y in 0..4 {
        for phase_x in 0..4 {
            let d = RawDescriptor {
                cfa: CfaPattern::Qrggb,
                cfa_phase_x: phase_x,
                cfa_phase_y: phase_y,
                ..RawDescriptor::default()
            };
            for output_y in 0..4 {
                for output_x in 0..4 {
                    let expected = bayer_site(
                        CfaPattern::Rggb,
                        output_x + u32::from(phase_x) / 2,
                        output_y + u32::from(phase_y) / 2,
                    );
                    assert_eq!(
                        structural_preview_site(&d, DisplayMode::Bayer, output_x, output_y),
                        Some(expected),
                        "phase ({phase_x}, {phase_y}), output ({output_x}, {output_y})"
                    );
                }
            }
        }
    }
}

#[test]
fn structural_lod_keeps_cfa_phase_continuous_across_tile_boundaries() {
    let d = RawDescriptor {
        width: 512,
        height: 256,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Qrggb,
        cfa_phase_x: 3,
        ..RawDescriptor::default()
    };
    let mut bytes = Vec::with_capacity((d.width * d.height) as usize);
    for y in 0..d.height {
        for x in 0..d.width {
            bytes.push(match cfa_site(&d, x, y) {
                CfaSite::Red => 220,
                CfaSite::GreenRed => 140,
                CfaSite::GreenBlue => 90,
                CfaSite::Blue => 40,
                CfaSite::Mono => unreachable!(),
            });
        }
    }
    let (layout, _) = calculate_layout(&d, bytes.len() as u64);
    let render = |tile_x| {
        render_tile(
            &bytes,
            &d,
            &layout,
            &TileRequest {
                generation: 1,
                render_revision: 1,
                frame: 0,
                level: 2,
                tile_x,
                tile_y: 0,
                tile_size: 64,
                mode: DisplayMode::Bayer,
                processing: ProcessingSettings::default(),
                display_window: DisplayWindow {
                    black_point: 0,
                    white_point: 255,
                },
            },
        )
        .unwrap()
    };
    let left = render(0);
    let right = render(1);
    assert_eq!(&left[63 * 4..64 * 4], &[220, 0, 0, 255]);
    assert_eq!(&right[0..4], &[0, 140, 0, 255]);
}

#[test]
fn adjacent_mipi14_quad_tiles_keep_boundary_rows_exact() {
    let descriptor = RawDescriptor {
        width: 260,
        height: 512,
        bit_depth: 14,
        packing: Packing::MipiRaw14,
        cfa: CfaPattern::Qrggb,
        ..RawDescriptor::default()
    };
    let mut bytes = Vec::new();
    for y in 0..descriptor.height {
        let values = (0..descriptor.width)
            .map(|x| ((x * 17 + y * 31) & 0x3fff) as u16)
            .collect::<Vec<_>>();
        bytes.extend_from_slice(
            &encode_row(
                &values,
                Packing::MipiRaw14,
                14,
                Endianness::Little,
                BitAlignment::Lsb,
            )
            .unwrap(),
        );
    }
    let (layout, warnings) = calculate_layout(&descriptor, bytes.len() as u64);
    assert!(warnings.is_empty());

    for mode in [DisplayMode::Raw, DisplayMode::Bayer, DisplayMode::Remosaic] {
        let render = |tile_y| {
            render_tile(
                &bytes,
                &descriptor,
                &layout,
                &TileRequest {
                    generation: 1,
                    render_revision: 1,
                    frame: 0,
                    level: 0,
                    tile_x: 0,
                    tile_y,
                    tile_size: 256,
                    mode,
                    processing: ProcessingSettings::default(),
                    display_window: DisplayWindow {
                        black_point: 0,
                        white_point: 0x3fff,
                    },
                },
            )
            .unwrap()
        };
        let upper = render(0);
        let lower = render(1);
        for x in 0..256u32 {
            for (tile, local_y, source_y) in [(&upper, 255u32, 255u32), (&lower, 0, 256)] {
                let expected = sampled_rgb_l0(
                    &bytes,
                    &descriptor,
                    &layout,
                    0,
                    (x, source_y),
                    mode,
                    ProcessingSettings::default(),
                )
                .unwrap();
                let index = ((local_y * 256 + x) * 4) as usize;
                assert_eq!(
                    &tile[index..index + 4],
                    &[
                        normalize(expected[0], 0, 0x3fff),
                        normalize(expected[1], 0, 0x3fff),
                        normalize(expected[2], 0, 0x3fff),
                        255,
                    ],
                    "mode {mode:?}, source ({x}, {source_y})",
                );
            }
        }
    }
}

#[test]
fn coarse_demosaic_uses_cfa_channel_means_and_explicit_missing_channel_fallbacks() {
    let d = RawDescriptor {
        width: 4,
        height: 4,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Rggb,
        ..RawDescriptor::default()
    };
    let data = [
        0, 40, 200, 40, 40, 80, 40, 80, 100, 40, 240, 40, 40, 80, 40, 80,
    ];
    let l = calculate_layout(&d, data.len() as u64).0;
    let request = TileRequest {
        generation: 1,
        render_revision: 1,
        frame: 0,
        level: 0,
        tile_x: 0,
        tile_y: 0,
        tile_size: 64,
        mode: DisplayMode::Demosaic,
        processing: ProcessingSettings::default(),
        display_window: DisplayWindow {
            black_point: 0,
            white_point: 255,
        },
    };
    let fine = render_tile(&data, &d, &l, &request).unwrap();
    assert_eq!(
        [fine[0], fine[4], fine[64 * 4], fine[65 * 4]],
        [0, 100, 50, 135]
    );
    let coarse = render_tile(
        &data,
        &d,
        &l,
        &TileRequest {
            level: 1,
            ..request.clone()
        },
    )
    .unwrap();
    assert_eq!(&coarse[..4], &[0, 40, 80, 255]);
    let edge = RawDescriptor {
        width: 3,
        height: 3,
        ..d
    };
    let data = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    let l = calculate_layout(&edge, 9).0;
    let coarse = render_tile(
        &data,
        &edge,
        &l,
        &TileRequest {
            level: 1,
            ..request.clone()
        },
    )
    .unwrap();
    assert_eq!(&coarse[65 * 4..66 * 4], &[90, 90, 90, 255]);
    let green = render_tile(
        &data,
        &edge,
        &l,
        &TileRequest {
            level: 1,
            mode: DisplayMode::Green,
            ..request
        },
    )
    .unwrap();
    assert_eq!(green[65 * 4 + 3], 254);
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
                render_revision: 1,
                frame: 0,
                level,
                tile_x: 0,
                tile_y: 0,
                tile_size: 64,
                mode: DisplayMode::Demosaic,
                processing: ProcessingSettings::default(),
                display_window: DisplayWindow {
                    black_point: 0,
                    white_point: 255,
                },
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
        render_revision: 1,
        frame: 0,
        level: 1,
        tile_x: 0,
        tile_y: 0,
        tile_size: 64,
        mode: DisplayMode::Raw,
        processing: ProcessingSettings::default(),
        display_window: DisplayWindow {
            black_point: 0,
            white_point: 255,
        },
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
        render_revision: 1,
        frame: 1,
        level: 0,
        tile_x: 0,
        tile_y: 0,
        tile_size: 64,
        mode: DisplayMode::Demosaic,
        processing: ProcessingSettings::default(),
        display_window: DisplayWindow {
            black_point: 0,
            white_point: 1023,
        },
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
fn reorder_support_matches_actual_source_coordinates_for_phases_and_crops() {
    for cfa in [
        CfaPattern::Qrggb,
        CfaPattern::Qbggr,
        CfaPattern::Qgbrg,
        CfaPattern::Qgrbg,
    ] {
        for size in 1..=17 {
            for phase in 0..4 {
                let d = RawDescriptor {
                    width: size,
                    height: size,
                    cfa,
                    cfa_phase_x: phase,
                    cfa_phase_y: phase,
                    ..RawDescriptor::default()
                };
                for start in 0..size {
                    for length in 1..=size - start {
                        for mode in [DisplayMode::Remosaic, DisplayMode::Demosaic] {
                            let halo = u32::from(matches!(mode, DisplayMode::Demosaic));
                            let range =
                                start.saturating_sub(halo)..(start + length + halo).min(size);
                            let readable = range.clone().all(|v| {
                                reordered_source_coordinate(v, phase).is_some_and(|s| s < size)
                            });
                            let support = unsupported_reorder_edges(
                                &d,
                                ProcessingSettings::default(),
                                mode,
                                (start, start, length, length),
                            );
                            assert_eq!(
                                support.is_empty(),
                                readable,
                                "{size} {phase} {start} {length}"
                            );
                        }
                    }
                }
                if unsupported_reorder_edges(
                    &d,
                    ProcessingSettings::default(),
                    DisplayMode::Remosaic,
                    (0, 0, size, size),
                )
                .is_empty()
                {
                    let mut values: Vec<_> = (0..size)
                        .map(|v| reordered_source_coordinate(v, phase).unwrap())
                        .collect();
                    values.sort();
                    assert_eq!(values, (0..size).collect::<Vec<_>>());
                    for v in 0..size {
                        assert_eq!(
                            reordered_source_coordinate(
                                reordered_source_coordinate(v, phase).unwrap(),
                                phase
                            ),
                            Some(v)
                        );
                    }
                }
            }
        }
    }
}

#[test]
fn export_rejects_reorder_geometry_before_replacing_output_and_checks_rgb_halo() {
    let d = RawDescriptor {
        width: 8,
        height: 8,
        bit_depth: 8,
        packing: Packing::Unpacked8,
        cfa: CfaPattern::Qrggb,
        cfa_phase_x: 2,
        ..RawDescriptor::default()
    };
    let source: Vec<u8> = (0..64).collect();
    let layout = calculate_layout(&d, 64).0;
    let output = test_output_path("reorder-boundary");
    fs::write(&output, b"existing").unwrap();
    let mut request = test_export_request(&d, &output, ExportTarget::Remosaic);
    assert_eq!(
        export_raw(&source, &d, &layout, &request).unwrap_err(),
        "export_reorder_boundary:left,right"
    );
    assert_eq!(fs::read(&output).unwrap(), b"existing");
    request.crop_x = 1;
    request.crop_width = 6;
    let result = export_raw(&source, &d, &layout, &request).unwrap();
    assert_eq!(
        result.filled_pixels.red
            + result.filled_pixels.green_red
            + result.filled_pixels.green_blue
            + result.filled_pixels.blue,
        0
    );
    request.target = ExportTarget::Demosaic;
    assert!(
        export_raw(&source, &d, &layout, &request)
            .unwrap_err()
            .starts_with("export_reorder_boundary:")
    );
    request.crop_x = 2;
    request.crop_width = 4;
    assert_eq!(
        export_raw(&source, &d, &layout, &request)
            .unwrap()
            .filled_pixels
            .rgb,
        0
    );
    request.crop_x = 0;
    request.crop_width = 8;
    request.processing.remosaic.same_color_reconstruction = true;
    assert!(export_raw(&source, &d, &layout, &request).is_ok());
    request.target = ExportTarget::OriginalCfa;
    request.processing.remosaic.same_color_reconstruction = false;
    assert!(export_raw(&source, &d, &layout, &request).is_ok());
    fs::remove_file(output).unwrap();
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
    let output = test_output_path("export-fill");
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
    let output = test_output_path("export-quad-phase");
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
    let output = test_output_path("export-remosaic-reorder");
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
    let output = test_output_path("export-remosaic-phase");
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
    let output = test_output_path("export-remosaic-reconstruct");
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
        let output = test_output_path("export-rgb48");
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
    let output = test_output_path("export-quad-rgb48");
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
    let mono_output = test_output_path("export-mono-rgb");
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
    let output = test_output_path("export-partial-rgb");
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
fn quad_demosaic_original_inspection_reads_source_dn_without_changing_rgb() {
    for cfa in [
        CfaPattern::Qrggb,
        CfaPattern::Qbggr,
        CfaPattern::Qgbrg,
        CfaPattern::Qgrbg,
    ] {
        for px in 0..4 {
            for py in 0..4 {
                for reconstruct in [false, true] {
                    for length in [7, 16] {
                        let d = RawDescriptor {
                            width: 4,
                            height: 4,
                            bit_depth: 8,
                            packing: Packing::Unpacked8,
                            cfa,
                            cfa_phase_x: px,
                            cfa_phase_y: py,
                            ..RawDescriptor::default()
                        };
                        let data: Vec<u8> = (0..length).collect();
                        let layout = calculate_layout(&d, data.len() as u64).0;
                        let request = PixelInspectionRequest {
                            generation: 1,
                            frame: 0,
                            x: 0,
                            y: 0,
                            width: 4,
                            height: 4,
                            mode: DisplayMode::Demosaic,
                            processing: ProcessingSettings {
                                remosaic: RemosaicOptions {
                                    same_color_reconstruction: reconstruct,
                                },
                                ..ProcessingSettings::default()
                            },
                        };
                        let inspected = inspect_pixels(&data, &d, &layout, &request).unwrap();
                        for (index, pixel) in inspected.chunks_exact(10).enumerate() {
                            let expected = (index < length as usize).then_some(index as u16);
                            assert_eq!(pixel[0] & 1 != 0, expected.is_some());
                            if let Some(value) = expected {
                                assert_eq!(u16::from_le_bytes([pixel[2], pixel[3]]), value);
                            }
                        }
                        if px == 0
                            && py == 0
                            && cfa == CfaPattern::Qrggb
                            && !reconstruct
                            && length == 16
                        {
                            let pixel = &inspected[10..20];
                            assert_eq!(pixel[0] & 3, 3);
                            assert_eq!([pixel[4], pixel[6], pixel[8]], [0, 2, 10]);
                            let reordered = inspect_pixels(
                                &data,
                                &d,
                                &layout,
                                &PixelInspectionRequest {
                                    mode: DisplayMode::Remosaic,
                                    ..request
                                },
                            )
                            .unwrap();
                            assert_eq!(u16::from_le_bytes([reordered[12], reordered[13]]), 2);
                        }
                    }
                }
            }
        }
    }
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
