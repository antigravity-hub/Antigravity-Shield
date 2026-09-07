//! Estimation Calibrator Module
//!
//! Learns from historical request/response pairs to improve token estimation accuracy.
//! Uses actual token counts from Google API responses to calibrate future estimates.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use tracing::info;

/// Estimation Calibrator - learns estimation error from historical requests
///
/// This module tracks the ratio between estimated tokens (before request) and
/// actual tokens (from Google API response) to improve future estimations.
pub struct EstimationCalibrator {
    /// Cumulative estimated tokens
    total_estimated: AtomicU64,
    /// Cumulative actual tokens (from Google API)
    total_actual: AtomicU64,
    /// Sample count
    sample_count: AtomicU64,
    /// Current calibration factor (estimated * factor ≈ actual)
    calibration_factor: RwLock<f32>,
}

impl EstimationCalibrator {
    /// Create a new calibrator with default settings
    pub const fn new() -> Self {
        Self {
            total_estimated: AtomicU64::new(0),
            total_actual: AtomicU64::new(0),
            sample_count: AtomicU64::new(0),
            // Initial assumption: estimates are 2.0x lower than actual
            // This is conservative and will be adjusted based on real data
            calibration_factor: RwLock::new(2.0),
        }
    }

    /// Record a request's estimated vs actual token counts
    ///
    /// Call this after receiving a response from Google API with actual token usage.
    pub fn record(&self, estimated: u32, actual: u32) {
        if estimated == 0 || actual == 0 {
            return;
        }

        self.total_estimated
            .fetch_add(estimated as u64, Ordering::Relaxed);
        self.total_actual
            .fetch_add(actual as u64, Ordering::Relaxed);
        let count = self.sample_count.fetch_add(1, Ordering::Relaxed) + 1;

        // Update calibration factor every 5 requests
        if count % 5 == 0 {
            self.update_calibration();
        }
    }

    /// Update the calibration factor based on accumulated data
    fn update_calibration(&self) {
        let estimated = self.total_estimated.load(Ordering::Relaxed) as f64;
        let actual = self.total_actual.load(Ordering::Relaxed) as f64;

        if estimated > 0.0 {
            let new_factor = (actual / estimated) as f32;
            // Clamp to reasonable range [0.8, 4.0]
            // - Below 0.8 means we're overestimating (rare)
            // - Above 4.0 means severe underestimation
            let clamped = new_factor.clamp(0.8, 4.0);

            if let Ok(mut factor) = self.calibration_factor.write() {
                // Exponential moving average: 60% old + 40% new
                // This provides stability while still adapting to changes
                let old = *factor;
                *factor = old * 0.6 + clamped * 0.4;

                info!(
                    "[Calibrator] Updated factor: {:.2} -> {:.2} (raw: {:.2}, samples: {})",
                    old,
                    *factor,
                    new_factor,
                    self.sample_count.load(Ordering::Relaxed)
                );
            }
        }
    }

    /// Get a calibrated estimate from a raw estimate
    ///
    /// Multiplies the raw estimate by the current calibration factor.
    pub fn calibrate(&self, estimated: u32) -> u32 {
        let factor = self.calibration_factor.read().map(|f| *f).unwrap_or(2.0);

        (estimated as f32 * factor).ceil() as u32
    }

    /// Get the current calibration factor
    pub fn get_factor(&self) -> f32 {
        self.calibration_factor.read().map(|f| *f).unwrap_or(2.0)
    }
}

impl Default for EstimationCalibrator {
    fn default() -> Self {
        Self::new()
    }
}

// Global singleton instance
use std::sync::OnceLock;

static CALIBRATOR: OnceLock<EstimationCalibrator> = OnceLock::new();

/// Get the global calibrator instance
pub fn get_calibrator() -> &'static EstimationCalibrator {
    CALIBRATOR.get_or_init(EstimationCalibrator::new)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calibrator_basic() {
        let calibrator = EstimationCalibrator::new();

        // Initial factor should be 2.0
        assert!((calibrator.get_factor() - 2.0).abs() < 0.01);

        // Record some samples where actual is 3x estimated
        for _ in 0..10 {
            calibrator.record(100, 300);
        }

        // Factor should have moved towards 3.0
        let factor = calibrator.get_factor();
        assert!(factor > 2.0);
        assert!(factor < 3.5);
    }

    #[test]
    fn test_calibrate() {
        let calibrator = EstimationCalibrator::new();

        // With default factor of 2.0, 100 should become 200
        let calibrated = calibrator.calibrate(100);
        assert_eq!(calibrated, 200);
    }

    #[test]
    fn test_zero_handling() {
        let calibrator = EstimationCalibrator::new();

        // Recording zeros should not affect anything
        calibrator.record(0, 100);
        calibrator.record(100, 0);

        assert_eq!(calibrator.sample_count.load(Ordering::Relaxed), 0);
    }
}
