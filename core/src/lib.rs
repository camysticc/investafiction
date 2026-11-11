//! Investafiction core library.
//!
//! Opens and verifies case packs, keeps the read-only evidence store,
//! writes saves and the audit trail, and runs the scoring engine. The
//! answer key stays in this layer until the player submits a report.

pub mod api;
pub mod attempt;
pub mod engine;
pub mod model;
pub mod pack;
pub mod pdf;
pub mod report;
pub mod scoring;
pub mod util;

pub use api::{call, dispatch};
pub use engine::Engine;
