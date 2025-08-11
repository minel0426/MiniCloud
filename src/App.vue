<template>
  <div id="app">
    <miniCloud></miniCloud>
  </div>
</template>

<script>
import miniCloud from './components/miniCloud.vue'

export default {
  name: 'App',
  components: {
    miniCloud,  // 正确注册组件
  },
};
</script>

<style></style>
