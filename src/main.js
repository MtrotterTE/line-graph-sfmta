import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Vuetify styles
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const vuetify = createVuetify({
    components,
    directives,
    theme: {
        defaultTheme: 'light', // Ensure the default theme is set
        variations: {
            colors: ['primary', 'secondary'], // Ensure these colors are included
            lighten: 5,
            darken: 5,
        },
        themes: {
            light: {
                colors: {
                    primary: '##D3D3D3',
                    secondary: '#F3F3F3',
                    next: '#708090',
                    prev: '#708090',
                    all: '#87CEEB',
                },
            },
            dark: {
                colors: {
                    primary: '##D3D3D3',
                    secondary: '#F3F3F3',
                    next: '#708090',
                    prev: '#708090',
                    all: '#87CEEB',
                },
            },
        },
    },
})

createApp(App).use(vuetify).mount('#app')
