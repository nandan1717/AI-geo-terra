async function run() {
    try {
        const url = 'https://api.gdeltproject.org/api/v2/geo/geo?query=sourcelang:eng&mode=PointData&format=geojson&maxrows=5&timespan=60min';
        console.log("Fetching:", url);
        const response = await fetch(url);
        const data = await response.json();
        console.log(JSON.stringify(data.features[0], null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

run();
