<script>
  /**
   * Root layout — passthrough.
   * @param {{ children: import('svelte').Snippet }} props
   */
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
