# Viro / SPECS semantic parity matrix

This matrix defines the application-visible contract. The engines do not need
to share implementation code.

| Viro semantic | ViroCore | SPECS 27 Lens backend |
| --- | --- | --- |
| group hierarchy | native Viro node tree | SceneObject hierarchy |
| position | meters | meters at public boundary, converted to cm |
| rotation | Euler degrees in JSX | compiled quaternion |
| scale | unitless | unitless |
| text | ViroText | Lens Text |
| image | ViroImage | Lens Image/Texture |
| GLB/model | Viro3DObject | ObjectPrefab |
| hover | Viro event delegate | SIK hover |
| click/select | Viro click | SIK trigger/pinch |
| drag | Viro drag | InteractableManipulation |
| animation | Viro animation manager | AnimationPlayer |
| hit test | native AR hit test | WorldQuery |
| placement | native AR placement patterns | SurfacePlacement |
| polyline | ViroPolyline | VolumetricLine |
| capabilities | runtime/native queries | SPECS capability report |

The cross-platform Platform Lab and the SPECS LEAF suite are complementary:
the Viro repo proves JSX compilation and callback semantics; the external
backend proves real Lens execution.
