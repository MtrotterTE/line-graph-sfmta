<template>
    <div class="rail navigation-rail pa-4">
        <div class="nav-buttons">
            <h2>Distance vs Time</h2>
            <v-btn size="large">K Line Outbound</v-btn>
            <v-btn size="large">K Line Inbound</v-btn>
            <h2>Distance vs Speed</h2>
            <v-btn size="large">K Line Outbound</v-btn>
            <v-btn size="large">K Line Inbound</v-btn>
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
    background-color: #f9f8f7;
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

.v-btn span {
    text-wrap: auto;
    white-space: normal;
    color: #010101;
}

h2 {
    font-size: 1.25rem;
    font-weight: 400;
    border-bottom: 1px solid #010101;
    margin-top: 16px;
    color: #010101;
}
</style>
