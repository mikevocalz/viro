# Handoff: Navigation

Produced with `design:design-handoff`. Tokens from `../spatial-tokens.md`, copy from `../copy.md`.

## Overview

The WS3b reference flow (pack section 9): select card → details → change setting → update view → back to list with scroll position preserved. Runs standalone in the Lens, no phone or server. The wearer's job: open a card, flip a setting, come back and find their place.

## Layout

One SpatialPanel at 1.5 m, 20 deg wide. List and detail swap inside the same panel; the panel itself never moves (no vection).

```
List                                   Detail
[ Navigation                    ]      [ < Back      Card 2             ]
[ ┌───────────┐ ┌───────────┐   ]      [ (image)                        ]
[ │ Card 1    │ │ Card 2    │   ]      [ Body text, up to 4 lines       ]
[ └───────────┘ └───────────┘   ]      [                                ]
[ ┌───────────┐ ┌───────────┐   ]      [ Show labels      [ On  ✓ ]     ]
[ │ Card 3    │ │ Card 4    │   ]      [                                ]
[ └───────────┘ └───────────┘   ]      [                                ]
[            [ Next scene ]     ]
```

- List: SpatialScrollView, 2 columns, gap `space.md`, 8 cards total so the list scrolls.
- Card: `surfaceRaised`, `radius.card`, PanelImage + `type.body` title. Whole card is one interactable.
- Detail: Back top-left, title, PanelImage, body, one toggle (PanelButton with selected state).

## Components and labels

| Component | viroTag | label |
| --- | --- | --- |
| SpatialScrollView | `nav-list` | none (container) |
| Card n | `nav-card-{n}` | "Card {n}" (real product: the item name) |
| Back | `nav-back` | "Back" |
| Setting toggle | `nav-setting-labels` | "Show labels", host appends ", selected" |
| Scroll up / down (gaze-only) | `nav-scroll-up`, `nav-scroll-down` | "Scroll up", "Scroll down" |
| Next scene | `nav-next` | "Next scene" |

Stable `viroTag`s on every card are required: WS2 content-hash IDs would also work, but the selected-card and scroll restore depend on IDs not shifting.

## State and data

- Selected card ID, scroll offset and setting values live in app state (Zustand on RN, portable action/state contract in the Lens, per WS3b).
- Changing the setting in detail updates the card in the list (e.g. the card shows its label when "Show labels" is on). Coming back shows the updated card.
- Back restores the scroll offset and puts the hover/focus on the card that was opened.

## Motion

| Transition | Animation | Duration | Easing |
| --- | --- | --- | --- |
| List → detail | Crossfade content inside the panel; opened card's image scales from its list size to detail size in place | `motion.slow` 400 ms | EaseInEaseOut |
| Detail → list | Reverse crossfade; returning card gets the hover ring | `motion.slow` | EaseInEaseOut |
| Toggle | Selected fill + check | `motion.fast` 120 ms | EaseInEaseOut |
| Scroll | Native SpatialScrollView scroll | n/a | n/a |

The panel never slides left or right; sliding a 50 cm panel across the view is the large-surface motion the pack forbids. Reduced motion: instant swap, focus still restored.

## Lifecycle variants

| State | Behavior |
| --- | --- |
| loading | List shows card frames with placeholder fills; images fill in as they load. Cards are selectable once their title is known |
| degraded | Hand tracking off: dwell on cards, toggle and Back; scroll up/down buttons appear at the list's top and bottom edges |
| error | A card image fails: placeholder box at the image extents, card still opens. The whole list fails to apply: `error.scene` with the previous view kept |

## Edge cases

- **Navigation during a pending action**: queued actions for the list are invalidated when detail opens (pack WS3 ownership rule). A late image completion for a card that is no longer visible is dropped, not applied to the detail view.
- **Back pressed twice quickly**: second press ignored until the transition ends.
- **Card removed by an update while detail is open**: Back returns to the list at the nearest remaining card; the scroll offset clamps.
- **100-cycle navigation** (pack WS3 test): no drift in scroll offset across cycles.

## Accessibility

Focus order list: title, cards in reading order, Next scene. Detail: Back, title, body, toggle. Back always sits in the same place. Checks A12, A15, R1, D3.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

| Flow | Why it's here |
| --- | --- |
| [Booking.com, List detail](https://mobbin.com/flows/2b3dd55d-0643-4561-a54e-d77046f65354) | List → detail with Back in a fixed spot |
| [Google Maps, List detail](https://mobbin.com/flows/283398e6-89df-4e79-b2c5-3befa7cdb274) | Detail keeps its header while content scrolls under it |
| [Vestiaire Collective, Item detail](https://mobbin.com/flows/eb18825d-f3ac-4cdb-a2d7-ff6ec19a4ae2) | Card grid → detail → related items, long scroll |
| [Superlist, List detail](https://mobbin.com/flows/258439a8-40a5-4574-b6f1-4bfd0327b57d) | Toggling items in detail and seeing the change reflected |
