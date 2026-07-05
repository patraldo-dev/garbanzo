<script>
  /**
   * Root layout — passthrough.
   * @param {{ children: import('svelte').Snippet }} props
   */
  let { children } = $props();
</script>

{@render children()}
