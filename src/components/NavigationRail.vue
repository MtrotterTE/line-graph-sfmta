<script setup>
const navButtons = ['Overview', 'Trips', 'Stations', 'Settings']
</script>

<template>
    <div class="rail navigation-rail pa-4">
        <div class="nav-buttons">
            <v-btn
                v-for="label in navButtons"
                :key="label"
                size="small"
            >
                {{ label }}
            </v-btn>
        </div>
    </div>
</template>

<style scoped>
.navigation-rail {
    margin: 4px 0 4px 4px;
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    display: flex;
    align-items: center;
    min-width: 180px;
}

.nav-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.nav-buttons .v-btn {
    justify-content: center;
}
</style>
