import * as React from "react";
import {
  PanelButton,
  PanelImage,
  PanelText,
  SpatialPanel,
  SpatialScrollView,
  ViroNode,
  ViroSpecsScene,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "../../index";
import { VIRO_SPECS_COPY } from "../../components/Specs/core/copy";

/**
 * The eight list items. Item names are data, not UI copy; a product screen
 * would load them. Row and column place each card in the two-column grid.
 */
const CARDS = [
  { tag: "nav-card-1", name: "Card 1", row: 0, column: 0 },
  { tag: "nav-card-2", name: "Card 2", row: 0, column: 1 },
  { tag: "nav-card-3", name: "Card 3", row: 1, column: 0 },
  { tag: "nav-card-4", name: "Card 4", row: 1, column: 1 },
  { tag: "nav-card-5", name: "Card 5", row: 2, column: 0 },
  { tag: "nav-card-6", name: "Card 6", row: 2, column: 1 },
  { tag: "nav-card-7", name: "Card 7", row: 3, column: 0 },
  { tag: "nav-card-8", name: "Card 8", row: 3, column: 1 },
];

export type NavigationSceneProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver: ViroSpecsSourceResolver;
  onOpenCard?: (tag: string) => void;
  onBack?: () => void;
  onToggleLabels?: () => void;
  onNext?: () => void;
};

/**
 * Platform Lab gallery, scene 4: Navigation (`docs/ux/handoff/navigation.md`).
 *
 * List and detail live inside one panel that never moves; the detail group
 * starts hidden. The WS3b actions contract swaps their visibility and fills
 * the detail title; the host keeps the list's scroll position under the
 * stable `nav-list` tag. Gaze-only Scroll up/down buttons are added by the
 * host when hand tracking is off.
 */
export function NavigationScene({ transport, sourceResolver, onOpenCard, onBack, onToggleLabels, onNext }: NavigationSceneProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver}>
      <SpatialPanel viroTag="nav-panel" position={[0, 0, -1.5]} width={0.53} height={0.5}>
        <ViroNode viroTag="nav-list-view">
          <PanelText viroTag="nav-title" role="title" text={VIRO_SPECS_COPY["gallery.navigation.title"]} position={[0, 0.2, 0.005]} />
          <SpatialScrollView viroTag="nav-list" position={[0, -0.01, 0.005]} width={0.48} height={0.3} itemHeight={0.13}>
            {CARDS.map((card) => (
              <PanelButton
                key={card.tag}
                viroTag={card.tag}
                label={card.name}
                position={[card.column === 0 ? -0.12 : 0.12, 0.085 - card.row * 0.13, 0]}
                width={0.22}
                height={0.11}
                onPress={() => onOpenCard?.(card.tag)}
              >
                <PanelImage
                  viroTag={card.tag + "-image"}
                  source={require("../visionos-sweep/assets/button.png")}
                  position={[-0.06, 0, 0.003]}
                  width={0.07}
                  height={0.05}
                />
              </PanelButton>
            ))}
          </SpatialScrollView>
          <PanelButton viroTag="nav-next" label={VIRO_SPECS_COPY["nav.next"]} position={[0.14, -0.2, 0.005]} onPress={() => onNext?.()} />
        </ViroNode>
        <ViroNode viroTag="nav-detail" visible={false}>
          <PanelButton viroTag="nav-back" label={VIRO_SPECS_COPY["nav.back"]} position={[-0.19, 0.2, 0.005]} onPress={() => onBack?.()} />
          <PanelText viroTag="nav-detail-title" role="title" text="Card 1" position={[0.04, 0.2, 0.005]} />
          <PanelImage
            viroTag="nav-detail-image"
            source={require("../visionos-sweep/assets/button.png")}
            position={[0, 0.08, 0.005]}
            width={0.2}
            height={0.12}
          />
          <PanelText
            viroTag="nav-detail-body"
            role="body"
            text={VIRO_SPECS_COPY["gallery.navigation.cardBody"]}
            position={[0, -0.05, 0.005]}
            width={0.46}
            height={0.1}
          />
          <PanelButton
            viroTag="nav-setting-labels"
            label={VIRO_SPECS_COPY["gallery.navigation.showLabels"]}
            state="selected"
            position={[0, -0.17, 0.005]}
            onPress={() => onToggleLabels?.()}
          />
        </ViroNode>
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
