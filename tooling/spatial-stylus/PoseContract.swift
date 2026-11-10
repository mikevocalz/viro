import Foundation
import simd

@main
enum PoseContract {
    static func main() {
        let identity = ViroSpatialStylusPose(transform: matrix_identity_float4x4, timestampMs: 0)!
        precondition(identity.position == .zero)
        precondition(identity.orientation == SIMD4(0, 0, 0, 1))
        precondition(identity.timestampMs == 0)
        var transform = simd_float4x4(simd_quatf(angle: .pi / 2, axis: SIMD3(0, 1, 0)))
        transform.columns.3 = SIMD4(1, 2, 3, 1)
        let rotated = ViroSpatialStylusPose(transform: transform, timestampMs: 125)!
        precondition(rotated.position == SIMD3(1, 2, 3))
        precondition(abs(rotated.orientation.y - sqrt(0.5)) < 0.0001)
        precondition(abs(simd_length(rotated.orientation) - 1) < 0.0001)
        precondition((rotated.fields["orientation"] as! [Float]).count == 4)
        precondition(ViroSpatialStylusPose(transform: transform, timestampMs: .nan) == nil)
        transform.columns.0.x = .infinity
        precondition(ViroSpatialStylusPose(transform: transform, timestampMs: 1) == nil)
        precondition(ViroSpatialStylusPose(transform: simd_float4x4(), timestampMs: 1) == nil)
        transform = matrix_identity_float4x4
        transform.columns.0.x = -1
        precondition(ViroSpatialStylusPose(transform: transform, timestampMs: 1) == nil)
        print("PASS: native stylus translation, rotation, unit orientation, time and invalid-pose rejection")
    }
}
