<script setup>
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'

// Helper function to calculate distance between two geographic points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3 // Earth's radius in meters
    const toRadians = (deg) => (deg * Math.PI) / 180

    const φ1 = toRadians(lat1)
    const φ2 = toRadians(lat2)
    const Δφ = toRadians(lat2 - lat1)
    const Δλ = toRadians(lon2 - lon1)

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
}

// Helper function to calculate time elapsed in seconds
function calculateTimeElapsed(timestamp1, timestamp2) {
    return (new Date(timestamp2) - new Date(timestamp1)) / 1000 // Time in seconds
}

// Helper function to check if two points are within 200 feet of each other
function arePointsWithin350Feet(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const toRadians = (deg) => (deg * Math.PI) / 180;

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceInMeters = R * c; // Distance in meters
    const distanceInFeet = distanceInMeters * 3.28084; // Convert meters to feet

    return distanceInFeet <= 350; // Check if within 200 feet
}

defineProps({
    msg: String,
})

const count = ref(0)
const graphData = ref([])

// Load and process the data
onMounted(async () => {
    // Load data from gfts_realtime_data_2025-05-11_8-00.json
    const response = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-11_8-00.json`)
    const data = await response.json()

    // Convert the JSON object into an array
    const dataArray = Array.isArray(data) ? data : Object.values(data)

    // Group data by trip_id into a 2D array
    const filteredData = Object.values(
        dataArray.reduce((acc, item) => {
            if (item.route_id === "K" && item.direction_id === 1) { // Filter for route_id "K"
                if (!acc[item.trip_id]) {
                    acc[item.trip_id] = []
                }
                acc[item.trip_id].push(item)
            }
            return acc
        }, {})
    )
    console.log('Filtered Data:', filteredData);

    const uniqueTripCount = filteredData.length
    console.log("Number of unique trip_ids:", uniqueTripCount)

    filteredData.forEach((trip, index) => {
        if (trip[0].trip_id == "11755717_M13") {
            console.log("Found trip with ID 11755717_M13 at index:", index);
        }
    })

    // Filter data for trip_id "11735822_M13"
    //const filteredData = dataArray.filter((item) => item.trip_id === '11735822_M13')

    let cumulativeDistance = 0
    let cumulativeTime = 0

    // Load data from stops.json
    const stopsResponse = await fetch(`${import.meta.env.BASE_URL}data/stops.json`)
    const stopsData = await stopsResponse.json()

    // Convert the JSON object into an array
    const stopsArray = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)

    const allProcessedTrips = filteredData.map((trip) => {
        let cumulativeDistance = 0;
        let cumulativeTime = 0;

        return trip.map((item, index, array) => {
            if (index === 0) {
                return { cumulativeDistance: 0, cumulativeTime: 0 };
            }

            const prev = array[index - 1];
            const distance = calculateDistance(
                prev.latitude,
                prev.longitude,
                item.latitude,
                item.longitude
            );
            const time = calculateTimeElapsed(prev.timestamp, item.timestamp);
            cumulativeDistance += distance;
            cumulativeTime += time;

            return {
                cumulativeDistance,
                cumulativeTime,
                trip_id: item.trip_id,
            };
        }).slice(1); // remove (0,0)
    });

    graphData.value = allProcessedTrips; // Now it's an array of arrays
})

// Update the graph to use cumulative values
watch(
    () => graphData.value,
    (allTrips) => {
        if (!allTrips.length) return;

        const svg = d3.select('#line-graph');
        svg.selectAll('*').remove();

        const width = 1100;
        const height = window.innerHeight * 0.8;
        const margin = { top: 20, right: 30, bottom: 50, left: 60 };

        // Flatten trips to calculate global max
        const flatData = allTrips.flat();

        const x = d3.scaleLinear()
            .domain([0, d3.max(flatData, d => d?.cumulativeTime)])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(flatData, d => d?.cumulativeDistance)])
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d?.cumulativeTime))
            .y(d => y(d?.cumulativeDistance));

        // Axes
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(
                d3.axisBottom(x).tickFormat((d) => {
                    const minutes = Math.floor(d / 60);
                    const seconds = Math.floor(d % 60);
                    return `${minutes}m ${seconds}s`;
                })
            );

        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));

        // Color scale per trip
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Draw one line per trip
        allTrips.forEach((trip, i) => {
            svg.append('path')
                .datum(trip)
                .attr('fill', 'none')
                .attr('stroke', color(i))
                .attr('stroke-width', 1.5)
                .attr('d', line);
        });

        // Axis labels (same as before)
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Cumulative Time (seconds)');

        svg.append('text')
            .attr('x', -(height / 2))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('transform', 'rotate(-90)')
            .text('Cumulative Distance (meters)');
    },
    { immediate: true }
);
</script>

<template>
    <v-container>
        <v-row>
            <v-col>
                <v-card>
                    <v-card-title>
                        Tenco CityScale K Line Intersection Delays For Inbound K Line
                    </v-card-title>
                    <v-card-text>
                        <svg id="line-graph" width="1100" height="80vh"></svg> <!-- Updated dimensions -->
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.read-the-docs {
    color: #888;
}
</style>