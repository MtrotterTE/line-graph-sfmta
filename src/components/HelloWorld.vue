<script setup>
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import { calculateDistance, calculateTimeElapsed, arePointsWithin350Feet } from '../utils/helpers.js'

defineProps({
    msg: String,
})

const count = ref(0)
const graphData = ref([])

// Load and process the data
onMounted(async () => {
    // Load data from may 11 to may 16, 2025
    const responseDayOne = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-11_8-00_PST.json`)
    const responseDayTwo = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-12_8-00_PST.json`)
    const responseDayThree = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-13_8-00_PST.json`)
    const responseDayFour = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-14_8-00_PST.json`)
    const responseDayFive = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-15_8-00_PST.json`)
    const responseDaySix = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-16_8-00_PST.json`)
    const dataDayOne = await responseDayOne.json()
    const dataDayTwo = await responseDayTwo.json()
    const dataDayThree = await responseDayThree.json()
    const dataDayFour = await responseDayFour.json()
    const dataDayFive = await responseDayFive.json()
    const dataDaySix = await responseDaySix.json()

    // Convert the JSON object into an array
    const dataArrayDayOne = Array.isArray(dataDayOne) ? dataDayOne : Object.values(dataDayOne)
    const dataArrayDayTwo = Array.isArray(dataDayTwo) ? dataDayTwo : Object.values(dataDayTwo)
    const dataArrayDayThree = Array.isArray(dataDayThree) ? dataDayThree : Object.values(dataDayThree)
    const dataArrayDayFour = Array.isArray(dataDayFour) ? dataDayFour : Object.values(dataDayFour)
    const dataArrayDayFive = Array.isArray(dataDayFive) ? dataDayFive : Object.values(dataDayFive)
    const dataArrayDaySix = Array.isArray(dataDaySix) ? dataDaySix : Object.values(dataDaySix)

    const combinedData = [ 
        ...dataArrayDayOne,
        ...dataArrayDayTwo,
        ...dataArrayDayThree,
        ...dataArrayDayFour,
        ...dataArrayDayFive,
        ...dataArrayDaySix
    ];

    // Group data by trip_id, vehicle_id, and date into a 2D array
    const filteredData = Object.values(
        combinedData.reduce((acc, item) => {
            if (item.route_id === "K" && item.direction_id === 1) { // Filter for route_id "K" and direction inbound
                const uniqueKey = item.trip_id + '_' + item.vehicle_id + '_' + item.date_pst; // Unique key for grouping by trip_id, vehicle_id, and date
                if (!acc[uniqueKey]) {
                    acc[uniqueKey] = []
                }
                acc[uniqueKey].push(item)
            }
            return acc
        }, {})
    )

    // Log the number of unique trips for debugging purposes
    const uniqueTripCount = filteredData.length
    console.log("Number of unique trips:", uniqueTripCount)

    // Load data from stops.json
    const stopsResponse = await fetch(`${import.meta.env.BASE_URL}data/stops.json`)
    const stopsData = await stopsResponse.json()

    // Convert the stops JSON object into an array
    const stopsArray = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)

    // Longitude and latitude of San Jose and Geneva Ave to compare to first stop for each unique trip
    const startStationLongitude = stopsArray[0].inbound.stops[0].location.longitude;
    const startStationLatitude = stopsArray[0].inbound.stops[0].location.latitude;

    const allProcessedTrips = filteredData.map((trip) => {
        let cumulativeDistance = 0;
        let cumulativeTime = 0;

        return trip.map((item, index, array) => {
            if (index === 0 || arePointsWithin350Feet(item.latitude, item.longitude, startStationLatitude, startStationLongitude)) {
                // If it's the first point or within 350 feet of the start station, reset cumulative
                return { cumulativeDistance: 0, cumulativeTime: 0 };
            }

            // Calculate distance and time from the previous point
            const prev = array[index - 1];
            const distance = calculateDistance(
                prev.latitude,
                prev.longitude,
                item.latitude,
                item.longitude
            );
            const time = calculateTimeElapsed(prev.timestamp, item.timestamp);

            // Update cumulative values
            cumulativeDistance += distance;
            cumulativeTime += time;

            return {
                cumulativeDistance,
                cumulativeTime,
                trip_id: item.trip_id,
            };
        });
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
                        <svg id="line-graph" width="1100" height="80vh"></svg>
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