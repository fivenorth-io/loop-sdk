# [Live Demo (CodePen)](https://codepen.io/kureikain/pen/KwVGgLX)

<p class="codepen" data-height="620" data-default-tab="result" data-slug-hash="KwVGgLX" data-user="kureikain" style="height: 620px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1px solid #e3e3e3; border-radius: 8px; margin: 1em 0; padding: 1em;">
  <span>See the Pen <a href="https://codepen.io/kureikain/pen/KwVGgLX">
  Loop SDK Demo</a> by kureikain (<a href="https://codepen.io/kureikain">@kureikain</a>)
  on <a href="https://codepen.io">CodePen</a>.</span>
</p>
<script async src="https://cpwebassets.codepen.io/assets/embed/ei.js"></script>

## Local demos

From the SDK repository:

```bash
bun install
bun start
```

- Existing Loop SDK: <http://localhost:3030/>
- CIP-103 provider: <http://localhost:3030/cip103>

Use a backend with CIP-103 support and the matching wallet frontend. The CIP-103 demo supports connection/account/network methods, signing, ledger queries, transaction submission, and event logging. Its transfer helper builds a payload; submit it using a CIP-103 transaction button to exercise the standard flow.
