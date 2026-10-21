# NEXUS 2.0 visual identity — Vision2DCS

Vision2DCS uses locally committed NEXUS graphic assets to establish a coherent research-demo visual identity. The project is **not** a Siemens/ABB partner endorsement, OT certification or active telemetry display.

## Assets used in the repository

| Local asset | Use |
|---|---|
| [`public/nexus-x.svg`](../public/nexus-x.svg) | Compact navigation icon and app favicon |
| [`public/nexus-wordmark.svg`](../public/nexus-wordmark.svg) | NEXUS wordmark in the application header |
| [`docs/assets/nexus-official-midnight.svg`](assets/nexus-official-midnight.svg) | Dark-background documentation / README artwork |

These SVGs are served from this repository. Opening the demo requires **no live Google Drive requests**.

## Recorded source provenance

The existing project records identify the approved NEXUS 2.0 design pack as Google Drive `Logo/NEXUS_Identity_2_0`, from the third selected visual variant. In particular, the X icon was recorded as originating from `NEXUS_Official_X_Transparent.svg`:

- [Original folder recorded in project documentation](https://drive.google.com/drive/folders/1rU3QCrdwCdHB0tYVLIq0W6aPqpj3iOsY)
- [Recorded source SVG](https://drive.google.com/file/d/1FgLBcK8aojoFN_5Y2mv84hn6iaUVMYiu/view)
- Recorded file ID: `1FgLBcK8aojoFN_5Y2mv84hn6iaUVMYiu`

These are **provenance references carried forward from earlier project records**. A code repository and its CI alone cannot independently revalidate the owner's live Drive approval history or certify byte-for-byte equality to a file that may have changed.

## Palette and accessibility

| Token | Value |
|---|---|
| Midnight | `#0B0F19` |
| Navy | `#061524` |
| Cyan | `#00E0FF` |
| Blue | `#4EA8FF` |
| Lavender | `#8F9BFF` |
| Violet | `#6E55C6` |
| Silver | `#B9C5CE` |

The application styles these tokens in `index.css`. Put an accessible **Vision2DCS** product title next to the brand mark. When the brand mark merely repeats adjacent text, treat the image as decorative. Keep keyboard focus visible, avoid relying on color alone for the difference between declared and heuristic signal edges, and respect reduced-motion preferences.

Verify UI changes through an actual Chromium browser run and visual review. TypeScript and Vitest passing **does not** establish WCAG conformance, real-world safety, or certified vendor interoperability.
