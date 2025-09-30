<script setup>
import { computed, ref } from 'vue'
import NavigationRail from './components/NavigationRail.vue'
import KLineOutboundTime from './components/KLineOutboundTime.vue'
import KLineInboundTime from './components/KLineInboundTime.vue'
import KLineOutboundSpeed from './components/KLineOutboundSpeed.vue'
import KLineInboundSpeed from './components/KLineInboundSpeed.vue'

const views = {
    outboundTime: KLineOutboundTime,
    inboundTime: KLineInboundTime,
    outboundSpeed: KLineOutboundSpeed,
    inboundSpeed: KLineInboundSpeed,
}

const activeView = ref('inboundTime')

const currentComponent = computed(() => views[activeView.value] ?? KLineInboundTime)

const handleSelect = (view) => {
    if (view in views) {
        activeView.value = view
    }
}
</script>

<template>
    <div class="app-layout">
        <NavigationRail :active-view="activeView" @select-view="handleSelect" />
        <main class="content">
            <component :is="currentComponent" />
        </main>
    </div>
</template>

<style scoped>
.app-layout {
    display: flex;
    height: 100vh;
    align-items: stretch;
}

.content {
    flex: 1;
    padding: 16px 0;
    overflow: auto;
}
</style>
