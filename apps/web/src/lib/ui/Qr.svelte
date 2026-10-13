<script lang="ts">
  import QRCode from "qrcode";

  let { text }: { text: string } = $props();
  let svg = $state("");

  $effect(() => {
    void QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => (svg = s));
  });
</script>

<div class="qr">{@html svg}</div>
