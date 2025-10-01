<script setup>
const props = defineProps({
    activeView: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['select-view'])

const isActive = (view) => props.activeView === view

const handleSelect = (view) => {
    emit('select-view', view)
}
</script>

<template>
    <div class="rail navigation-rail pa-4">
        <div class="nav-buttons">
            <h1>Choose a Graph:</h1>
            <h2>Distance vs Time</h2>
            <v-btn
                size="large"
                :class="{ active: isActive('outboundTime') }"
                @click="handleSelect('outboundTime')"
            >
                K Line Outbound
            </v-btn>
            <v-btn
                size="large"
                :class="{ active: isActive('inboundTime') }"
                @click="handleSelect('inboundTime')"
            >
                K Line Inbound
            </v-btn>
            <h2>Distance vs Speed</h2>
            <v-btn
                size="large"
                :class="{ active: isActive('outboundSpeed') }"
                @click="handleSelect('outboundSpeed')"
            >
                K Line Outbound
            </v-btn>
            <v-btn
                size="large"
                :class="{ active: isActive('inboundSpeed') }"
                @click="handleSelect('inboundSpeed')"
            >
                K Line Inbound
            </v-btn>
        </div>
    </div>
</template>

<style scoped>
.navigation-rail {
    margin: 0;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    display: flex;
    align-items: start;
    align-self: stretch;
    box-sizing: border-box;
    min-width: 180px;
    background-color: #27292b;
    height: 100%;
    margin-right: 16px;
    border-right: 3px solid #515559;
    border-left: 3px solid #515559;
}

.nav-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.nav-buttons .v-btn {
    justify-content: center;
    background-color: #a4a6a2;
}

.nav-buttons .v-btn:hover {
    background-color: #f9f8f7;
}

.nav-buttons .v-btn.active {
    background-color: #f9f8f7;
}

.nav-buttons .v-btn .v-btn__content {
    text-wrap: auto;
    white-space: normal;
    color: #010101;
}

.nav-buttons .v-btn.active .v-btn__content {
    color: #f9f8f7;
}

h2, h1 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 16px;
    color: #b8bdc2;
    line-height: 1.5;
}
</style>
