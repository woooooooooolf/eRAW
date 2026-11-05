//! Regression for RUSTSEC-2024-0429. Run in both debug and optimized profiles.
#![cfg(target_os = "linux")]

use glib::variant::ToVariant;

#[test]
fn string_iteration_preserves_utf8_and_empty_values() {
    let values = ["", "alpha", "中文", "日本語", "é", "🦀"];
    let variant = values.to_variant();
    assert_eq!(variant.array_iter_str().unwrap().collect::<Vec<_>>(), values);
    assert_eq!(
        variant.array_iter_str().unwrap().rev().collect::<Vec<_>>(),
        values.into_iter().rev().collect::<Vec<_>>()
    );
}

#[test]
fn every_affected_iterator_entry_point_returns_the_expected_string() {
    let variant = ["first", "second", "third", "fourth", "last"].to_variant();
    assert_eq!(variant.array_iter_str().unwrap().next(), Some("first"));
    assert_eq!(variant.array_iter_str().unwrap().next_back(), Some("last"));
    assert_eq!(variant.array_iter_str().unwrap().nth(2), Some("third"));
    assert_eq!(variant.array_iter_str().unwrap().nth_back(1), Some("fourth"));
    assert_eq!(variant.array_iter_str().unwrap().last(), Some("last"));
    let mut iter = variant.array_iter_str().unwrap();
    assert_eq!(iter.next(), Some("first"));
    assert_eq!(iter.next_back(), Some("last"));
    assert_eq!(iter.nth(1), Some("third"));
    assert_eq!(iter.next_back(), Some("fourth"));
    assert_eq!(iter.next(), None);
    assert_eq!(iter.next_back(), None);
}

#[test]
fn empty_and_exhausted_string_iterators_are_safe() {
    let variant = Vec::<String>::new().to_variant();
    assert_eq!(variant.array_iter_str().unwrap().next(), None);
    assert_eq!(variant.array_iter_str().unwrap().next_back(), None);
    assert_eq!(variant.array_iter_str().unwrap().nth(0), None);
    assert_eq!(variant.array_iter_str().unwrap().nth_back(0), None);
    assert_eq!(variant.array_iter_str().unwrap().last(), None);
}
