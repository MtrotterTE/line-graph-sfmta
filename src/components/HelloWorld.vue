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

// Helper function to check if two points are within 500 feet of each other
function arePointsWithin500Feet(lat1, lon1, lat2, lon2) {
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

    return distanceInFeet <= 500; // Check if within 500 feet
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

    // Filter data for trip_id "11735822_M13"
    const filteredData = dataArray.filter((item) => item.trip_id === '11735822_M13')

    let cumulativeDistance = 0
    let cumulativeTime = 0

    // Load data from stops.json
    const stopsResponse = await fetch(`${import.meta.env.BASE_URL}data/stops.json`)
    const stopsData = await stopsResponse.json()

    // Convert the JSON object into an array
    const stopsArray = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)

    console.log('Stops Data:', stopsArray)

    // Calculate distance and time differences cumulatively
    const processedData = filteredData.map((item, index, array) => {
        if (index === 0) {
            return { cumulativeDistance: 0, cumulativeTime: 0 }
        }
        const prev = array[index - 1]
        const distance = calculateDistance(
            prev.latitude,
            prev.longitude,
            item.latitude,
            item.longitude
        )
        const time = calculateTimeElapsed(prev.timestamp, item.timestamp)
        cumulativeDistance += distance
        cumulativeTime += time
        return {
            cumulativeDistance: cumulativeDistance,
            cumulativeTime: cumulativeTime,
        }
    })

    console.log('Processed Data:', processedData)

    // Add cumulative distance and time to each data point
    graphData.value = processedData.slice(1) // Remove the first entry (0, 0)
})

// Update the graph to use cumulative values
watch(
    () => graphData.value,
    (newData) => {
        console.log(newData)
        if (!newData.length) return

        const svg = d3.select('#line-graph')
        svg.selectAll('*').remove() // Clear previous graph

        const width = 1100 // Updated width
        const height = window.innerHeight * 0.8 // Updated height (80vh)
        const margin = { top: 20, right: 30, bottom: 50, left: 60 } // Adjusted margins for labels

        const x = d3
            .scaleLinear()
            .domain([0, d3.max(newData, (d) => d.cumulativeTime)]) // Use cumulativeTime for X
            .range([margin.left, width - margin.right])

        const y = d3
            .scaleLinear()
            .domain([0, d3.max(newData, (d) => d.cumulativeDistance)]) // Use cumulativeDistance for Y
            .range([height - margin.bottom, margin.top])

        const line = d3
            .line()
            .x((d) => x(d.cumulativeTime)) // Use cumulativeTime for X
            .y((d) => y(d.cumulativeDistance)) // Use cumulativeDistance for Y

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

        svg.append('path')
            .datum(newData)
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 1.5)
            .attr('d', line)

        // Add circles to each data point
        svg.selectAll('circle')
            .data(newData)
            .enter()
            .append('circle')
            .attr('cx', (d) => x(d.cumulativeTime))
            .attr('cy', (d) => y(d.cumulativeDistance))
            .attr('r', 5) // Circle radius
            .attr('fill', 'red')
            .on('mouseover', function (event, d) {
                const minutes = Math.floor(d.cumulativeTime / 60);
                const seconds = Math.floor(d.cumulativeTime % 60);
                tooltip
                    .style('opacity', 1)
                    .html(
                        `Cumulative Time: ${minutes}m ${seconds}s<br>Cumulative Distance: ${d.cumulativeDistance.toFixed(2)} m`
                    )
                    .style('left', `${event.pageX + 10}px`)
                    .style('top', `${event.pageY - 20}px`)
                    .style('color', 'black')
            })
            .on('mouseout', function () {
                tooltip.style('opacity', 0)
            })

        // Add tooltip
        const tooltip = d3
            .select('body')
            .append('div')
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('border', '1px solid #ccc')
            .style('padding', '5px')
            .style('border-radius', '5px')
            .style('opacity', 0)
            .style('pointer-events', 'none')
            .style('text-align', 'right'); // Right-align the text

        // Update x-axis label
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10) // Position below the x-axis
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Cumulative Time (seconds)')

        // Update y-axis label
        svg.append('text')
            .attr('x', -(height / 2))
            .attr('y', 15) // Position to the left of the y-axis
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('transform', 'rotate(-90)')
            .text('Cumulative Distance (meters)')
    },
    { immediate: true }
)
</script>

<template>
    <v-container>
        <v-row>
            <v-col>
                <v-card>
                    <v-card-title>
                        Tenco CityScale K Line Intersection Delays For Inbound Trip_ID = 11735822_M13
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