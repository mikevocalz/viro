import Foundation
import simd

/// Immutable pose captured from the existing ARKit accessory aim transform.
struct ViroSpatialStylusPose {
    let position: SIMD3<Float>
    let orientation: SIMD4<Float>
    let timestampMs: Double

    init?(transform: simd_float4x4, timestampMs: Double) {
        guard timestampMs.isFinite && timestampMs >= 0 else { return nil }
        for column in 0..<4 {
            for row in 0..<4 where !transform[column][row].isFinite { return nil }
        }
        let x = SIMD3(transform.columns.0.x, transform.columns.0.y, transform.columns.0.z)
        let y = SIMD3(transform.columns.1.x, transform.columns.1.y, transform.columns.1.z)
        let z = SIMD3(transform.columns.2.x, transform.columns.2.y, transform.columns.2.z)
        guard abs(simd_length(x) - 1) < 0.001,
              abs(simd_length(y) - 1) < 0.001,
              abs(simd_length(z) - 1) < 0.001,
              abs(simd_dot(x, y)) < 0.001,
              abs(simd_dot(x, z)) < 0.001,
              abs(simd_dot(y, z)) < 0.001,
              simd_dot(simd_cross(x, y), z) > 0.999,
              abs(transform.columns.0.w) < 0.001,
              abs(transform.columns.1.w) < 0.001,
              abs(transform.columns.2.w) < 0.001,
              abs(transform.columns.3.w - 1) < 0.001 else { return nil }
        let quaternion = simd_quatf(transform).vector
        let length = simd_length(quaternion)
        guard length.isFinite && length > 0 else { return nil }
        position = SIMD3(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
        orientation = quaternion / length
        self.timestampMs = timestampMs
    }

    var fields: [String: Any] {
        ["position": [position.x, position.y, position.z],
         "orientation": [orientation.x, orientation.y, orientation.z, orientation.w],
         "poseTimestampMs": timestampMs]
    }
}
