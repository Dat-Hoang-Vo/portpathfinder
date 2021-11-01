import { useEffect, useState } from 'react';
import ReactMapGL, { Marker, Layer, Source, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { Box } from '@mui/system';

import { Button, Menu, MenuItem, Slider, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import FmdGoodIcon from '@mui/icons-material/FmdGood';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import jsonPortData from './data/PortData.json';
import jsonOceanData from './data/OceanData.json';

import { getRoute } from './djikstra';

const speed = 0.1;

const coordinateMap = new Map();
const adjacentMap = new Map();

const MainMap = () => {
    const [route, setRoute] = useState([]);

    useEffect(() => {
        jsonPortData.map(Port => {
            adjacentMap.set(Port.portname, Port.Adjacent)
            coordinateMap.set(Port.portname, [Port.Longitude, Port.Latitude]);
        })
        jsonOceanData.map(Ocean => {
            adjacentMap.set(Ocean.locationName, Ocean.adjacent);
            coordinateMap.set(Ocean.locationName, [Ocean.longitude, Ocean.latitude]);
        })
    }, [])

    // Main Overview Map
    const [viewPort, setViewPort] = useState({
        mapboxApiAccessToken: 'pk.eyJ1IjoibmF2YWxuYXZpZ2F0aW9uIiwiYSI6ImNrdjdzZGlncTJtZzcybnExNGF0bzllenUifQ.aSwuQZ6mwl1SaWzu9DN1gw',
        width: '100vw',
        height: '99.9vh',
        latitude: 30,
        longitude: -35,
        zoom: 2,
        maxZoom: 5,
        minZoom: 2
    });

    const [coordinates, setCoordinates] = useState([[50, 50]]); // Data that the map uses to draw the path

    // The routes line JSON to be drawn is stored in coordiantes as coordinates
    const dataDrawRoute = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates
        },
    };

    const [popupInfo, setPopupInfo] = useState(null); // Holds the information for the popup of a port that's been clicked on

    const [start, setStart] = useState("New York"); // Starting location (Southampton is default)
    const [end, setEnd] = useState("Hong Kong"); // Final Destination (Hamburg is default)

    const [travelTime, setTravelTime] = useState("Get Path");
    const [travelCost, setTravelCost] = useState("Get Path");
    const [travelDistance, setTravelDistance] = useState("Get Path");
    const [validRoute, setValidRoute] = useState("Get Path");
    const [pathFound, setPathFound] = useState(false);
    const [locationColor, setLocationColor] = useState(new Map());
    const [showOceanTiles, setShowOceanTiles] = useState(false);

    const [currentShip, setCurrentShip] = useState("Serendipity");
    const [shipChoices, setShipChoices] = useState(
    <Box sx={{width: '100%'}}>
    <MenuItem onClick={() => {setCurrentShip("Serendipity"); handleCloseShipChoices()}}>Serendipity</MenuItem>
    <MenuItem onClick={() => {setCurrentShip("Liberty"); handleCloseShipChoices()}}>Liberty</MenuItem>
    </Box>)
    

    // Generates the port markers on the map
    const [portLocations, setPortLocations] = useState(
        jsonPortData.map(Port => {
            if (start === Port.portname) {
                locationColor.set(Port.portname, {color: "#2f8e31", transform: `translate(${-24 / 2}px,${-24}px)`});
            } else if (end === Port.portname) {
                locationColor.set(Port.portname, {color: "#b73838", transform: `translate(${-24 / 2}px,${-24}px)`});
            } else {
                locationColor.set(Port.portname, {color: "#000000", transform: `translate(${-24 / 2}px,${-24}px)`});
            }
            if (Port.isPort) {
                return (
                    <Box key={Port.ID} onClick={(e) => {
                        e.preventDefault();
                        setPopupInfo(Port);
                    }}>
                        <Marker latitude={Port.Latitude} longitude={Port.Longitude}>
                            <FmdGoodIcon style={locationColor.get(Port.portname)} />
                        </Marker>
                    </Box>
                )
            }
        })
    )

    // Handles Port markers
    useEffect(() => {
        setTravelDistance("Get Path");
        setTravelTime("Get Path");
        setTravelCost("Get Path");
        setValidRoute("Get Path");
        setPathFound(false);
        setDjikstraRunTime("Get Path");
        setNodesChecked("Get Path");
        setPortLocations(
            jsonPortData.map(Port => {
                if (start === Port.portname) {
                    locationColor.set(Port.portname, {color: "#2f8e31", transform: `translate(${-24 / 2}px,${-24}px)`});
                } else if (end === Port.portname) {
                    locationColor.set(Port.portname, {color: "#b73838", transform: `translate(${-24 / 2}px,${-24}px)`});
                } else {
                    locationColor.set(Port.portname, {color: "#080f3b", transform: `translate(${-24 / 2}px,${-24}px)`});
                }
                return (
                    <Box onClick={(e) => {
                        e.preventDefault();
                        setPopupInfo(Port);
                    }}>
                        <Marker latitude={Port.Latitude} longitude={Port.Longitude}>
                            <FmdGoodIcon style={locationColor.get(Port.portname)} />
                        </Marker>
                    </Box>
                )
            })
        )
    }, [start, end, currentShip])

    // Handle Ocean Markers
    const [oceanMarkers, setOceanMarkers] = useState(null);
    useEffect(() => {
        setOceanMarkers(jsonOceanData.map(oceanPoint => {
            return (
            <Marker key={oceanPoint.id} latitude={oceanPoint.latitude} longitude={oceanPoint.longitude}>
                <Box>
                {showOceanTiles && oceanPoint.locationName}
                </Box>
            </Marker>
        )}));
    }, [showOceanTiles])

    const [addToRoute, setAddToRoute] = useState(null);
    const [routeMemory, setRouteMemory] = useState(null);
    const [currentLon, setCurrentLon] = useState(0);
    const [currentLat, setCurrentLat] = useState(0);
    const [shipSpeed, setShipSpeed] = useState(10.3); // Speed in metres/second
    const [shipClass, setShipClass] = useState(1);
    const [displaySpeed, setDisplaySpeed] = useState(0.25);
    const [costPerDay, setCostPerDay] = useState(7500); // Cost per day in USD

    const [djikstraRunTime, setDjikstraRunTime] = useState(0);
    const [nodesChecked, setNodesChecked] = useState(0);
    // Start of get path function
    const handleGetPath = () => {
        var startTime = performance.now();
        setAddToRoute(getRoute(start, end, coordinateMap, adjacentMap, shipSpeed, costPerDay, shipClass));
        var endTime = performance.now();
        setDjikstraRunTime(Math.round(endTime - startTime) + " ms");
        setIsPaused(true);
        setDrawingRoute(false);
    }
    // Loads the path into a memory array that can be reused.
    useEffect(() => {
        if (addToRoute !== null) {
            setRouteMemory([]);
            addToRoute[0].forEach(node => {
                setRouteMemory(prevRoute => [...prevRoute, coordinateMap.get(node)]);
            })
            setTravelDistance((addToRoute[1] / 1000).toFixed(0) + " km");
            setTravelTime((addToRoute[2] / 24).toFixed(2) + " days");
            setTravelCost("$ " + addToRoute[3].toFixed(2));
            setNodesChecked(addToRoute[4]);
            setValidRoute("Found");
        } else {
            setValidRoute("No Route");
            setRoute(null);
        }
    }, [addToRoute])

    // Loads a temporary array used to draw the route. Each point is deleted once visited from array.
    useEffect(() => {
        console.log(routeMemory);
        if (routeMemory !== null) {
            setPathFound(true);
            setRoute(routeMemory);
            setCurrentLon(routeMemory[0][0]);
            setCurrentLat(routeMemory[0][1]);
            setCoordinates(routeMemory[0]);
        }
    }, [routeMemory])
    
    const [update, setUpdate] = useState(Date.now());
    const [updateTimer, setUpdateTimer] = useState(Math.pow(2,31) - 1);
    // This function sets the clock for drawing the line
    useEffect(() => {
        const interval = setInterval(() => setUpdate(Date.now()), updateTimer);
        return () => {clearInterval(interval)};
    }, [updateTimer]);

    const [step, setStep] = useState(0);
    const [maxStep, setMaxStep] = useState(20);
    const [drawingRoute, setDrawingRoute] = useState(false);
    useEffect(() => {
        const animation = window.requestAnimationFrame(() => {
            if (route !== null && route.length > 1) {                   // Handle Valid Route Size. Size must be > 2 since route[0] = from, and route[1] = to
                if (maxStep === -1) {
                    let longitudeDistance = route[1][0] - route[0][0];
                    let latitudeDistance = route[1][1] - route[0][1];
                    let totalDistance = Math.sqrt(Math.pow(longitudeDistance, 2) + Math.pow(latitudeDistance, 2));
                    setMaxStep(totalDistance / displaySpeed);
                }
                else if (step <= maxStep) {                                  // Handle taking a step
                    let longitudeDistance = route[1][0] - route[0][0];
                    let latitudeDistance = route[1][1] - route[0][1];
                    let totalDistance = Math.sqrt(Math.pow(longitudeDistance, 2) + Math.pow(latitudeDistance, 2));
                    setMaxStep(totalDistance / displaySpeed);
                    let latitudeChangePerStep = latitudeDistance / maxStep;
                    let longitudeChangePerStep = longitudeDistance / maxStep;
                    if (maxStep - step >= 1) {                          // Handle being able to take a full step
                        setCurrentLon(currentLon + longitudeChangePerStep);
                        setCurrentLat(currentLat + latitudeChangePerStep);
                    } else {                                            // Handle taking partial step
                        setCurrentLon(currentLon + longitudeChangePerStep * (maxStep - step));
                        setCurrentLat(currentLat + latitudeChangePerStep * (maxStep - step));
                    }
                    if (drawingRoute) { setCoordinates(prevArary => [...prevArary, [currentLon, currentLat]]); } // This is used in case a pause function is given during execution of this useEffect
                    else { setCoordinates([[]]) }
                    setStep(step + 1);
                }
                else {                                                  // Handle max steps taken
                    setRoute(route.slice(1));
                    setStep(0);
                    setMaxStep(-1);
                }
            } else { // Handle invalid routes that are too short
                setUpdateTimer(Math.pow(2,31) - 1);
            }
        })
        return () => window.cancelAnimationFrame(animation);
    }, [update]);

    const handleSetSail = () => {
        if (pathFound && route !== null && route.length > 1) {
            if (drawingRoute) {
                setIsPaused(true);
                setDrawingRoute(false);
                setUpdateTimer(Math.pow(2,31) - 1);
            } else {
                setIsPaused(false);
                setDrawingRoute(true);
                setUpdateTimer(20);
            }
            resetVisualization();
            console.log("Lat " + (route[route.length - 1][1] - route[0][1]) + " Lon " + (route[route.length - 1][0] - route[0][0]));
        }
    }

    const handleClearPath = () => {
        setIsPaused(true);
        setUpdateTimer(Math.pow(2,31) - 1);
        setDrawingRoute(false);
        if (route !== null) {
            resetVisualization();
        }
    }

    const [isPaused, setIsPaused] = useState(true);
    const handlePause = () => {
        if (isPaused) {
            setIsPaused(false);
            setUpdateTimer(20);
        } else {
            setIsPaused(true);
            setUpdateTimer(Math.pow(2,31) - 1);
        }
    }

    const resetVisualization = () => {
        setRoute(routeMemory);
        setStep(0);
        setMaxStep(-1);
        setCoordinates([[route[0][0], route[0][1]]]);
        setCurrentLon(route[0][0]);
        setCurrentLat(route[0][1]);
    }

    const [openShipChoices, setOpenShipChoices] = useState(null);
    const open = Boolean(openShipChoices);
    const handleOpenShipChoices = (event) => {
        setOpenShipChoices(event.currentTarget);
    };

    const handleCloseShipChoices = () => {
        setOpenShipChoices(null);
    }

    const [kielAccessMark, setKielAccessMark] = useState("");
    const [suezAccessMark, setSuezAccessMark] = useState("");
    const [panamaAccessMark, setPanamaAccessMark] = useState("");

    let checkMark = <CheckRoundedIcon sx={{color: "#2f8e31", margin: '0', padding: '0'}} />
    let crossMark = <CloseRoundedIcon sx={{color: "#b73838", margin: '0', padding: '0'}} />

    useEffect(() => {
        if (currentShip === "Serendipity") {
            setShipClass(1);
            setCostPerDay(7500);
            setShipSpeed(12.86);
            setKielAccessMark(checkMark);
            setSuezAccessMark(checkMark);
            setPanamaAccessMark(checkMark);
        } else if (currentShip === "Liberty") {
            setShipClass(2);
            setCostPerDay(11000);
            setShipSpeed(10.29);
            setKielAccessMark(crossMark);
            setSuezAccessMark(checkMark);
            setPanamaAccessMark(checkMark);
        }
    }, [currentShip])

    const handleToggleOceanTiles = () => { setShowOceanTiles(!showOceanTiles); }

    const handleSetStart = (port) => {
        if (start !== port && end !== port) { setStart(port); } 
        else if (end === port) { setEnd(start); setStart(port); }
    }
    const handleSetEnd = (port) => {
        if (start !== port && end !== port) { setEnd(port); } 
        else if (start === port) { setStart(end); setEnd(port); } 
    }

    return (
        <ReactMapGL
         {...viewPort}
         mapStyle = "mapbox://styles/navalnavigation/ckv7topqu8xin14o7jee6d1fs"
         onViewportChange= { nextViewport => { setViewPort(nextViewport) }}
        >
            {portLocations}
            {oceanMarkers}
            {popupInfo && (
                <Popup tipSize={5} anchor="top" longitude={popupInfo.Longitude} latitude={popupInfo.Latitude} closeOnClick={false} onClose={setPopupInfo}>
                    <Typography>{popupInfo.portname}, {popupInfo.country}</Typography>
                    <Stack>
                        <Button variant="outlined" onClick={() => {handleSetStart(popupInfo.portname)}}>Set Start</Button>
                        <Button variant="outlined" onClick={() => {handleSetEnd(popupInfo.portname)}}>Set End</Button>
                    </Stack>
                </Popup>
            )}

            
            <Source id="testLine" type="geojson" data={dataDrawRoute}>
            <Layer
                id="lineLayer"
                type="line"
                source="my-data"
                layout={{
                    "line-join": "round",
                    "line-cap": "round"
                }}
                paint={{
                    "line-color": "#000000",
                    "line-width": 2
                }}
            />
            </Source>

            <Box sx={{width: '22vw', height: '90vh', backgroundColor: '#222233', color: '#f9f0e1', position: 'absolute', top: '5vh', left: '2vw', borderRadius: '1vh'}}>

                <Stack spacing={2} sx={{width: "90%", marginLeft: 'auto', marginRight: 'auto', marginTop: '2vh'}}>
                    <Box>
                        <Typography variant="h6">Ship Description</Typography>
                        <Typography>Sailing on the <Button onClick={handleOpenShipChoices} sx={{color: '#d65757', padding: '0'}}>{currentShip}</Button></Typography>
                        <Menu anchorEl={openShipChoices} open={open} onClose={handleCloseShipChoices}>{shipChoices}</Menu>
                        <Typography>Traveling at a rate of {shipSpeed} m/s</Typography>
                        <Typography>Costing ${costPerDay} USD per day</Typography>
                    </Box>
                    <Box style={{width: '100%'}}>
                        <Box sx={{float: 'left'}}>
                            <Typography variant="h6">Canal Access</Typography>
                            <Typography>{kielAccessMark}Kiel Canal</Typography>
                            <Typography>{suezAccessMark}Suez Canal</Typography>
                            <Typography>{panamaAccessMark}Panama Canal</Typography>
                        </Box>
                        <Box sx={{float: 'right'}}>
                            <Typography variant="h6">Travel Information</Typography>
                            <Stack spacing={1}>
                                <Typography>Time: {travelTime}</Typography>
                                <Typography>Cost: {travelCost}</Typography>
                                <Typography>Distance: {travelDistance}</Typography>
                            </Stack>
                        </Box>
                    </Box>
                    <Box>
                        <Typography style={{float: 'left'}}>From: <FmdGoodIcon style={{color: "#2f8e31"}} />{start}</Typography>
                        <Typography style={{float: 'right'}}>To: <FmdGoodIcon style={{color: "#b73838"}} />{end}</Typography>
                    </Box>
                    <Box>
                        <Button variant="outlined" onClick={handleGetPath} style={{color: '#AACCFF', width: '40%'}}>Get Path</Button>
                        <Button variant="outlined" onClick={handleSetSail} style={{color: '#AACCFF', width: '40%'}}>Draw Path</Button>
                        <Button variant="outlined" onClick={handlePause} style={{color: '#AACCFF', width: '40%'}}>Pause</Button>
                        <Button variant="outlined" onClick={handleClearPath} style={{color: '#AACCFF', width: '40%'}}>Clear Path</Button>
                    </Box>
                    <Box>
                    <Typography sx={{display: 'inline'}}>Display Speed</Typography>
                    <ToggleButtonGroup value={displaySpeed} exclusive onChange={(event, newSpeed) => {setDisplaySpeed(newSpeed)}} color="warning">
                        <ToggleButton value={0.1}>
                            <Typography sx={{color: '#f9f0e1'}}>Slow</Typography>
                        </ToggleButton>
                        <ToggleButton value={0.25}>
                            <Typography sx={{color: '#f9f0e1'}}>Normal</Typography>
                        </ToggleButton>
                        <ToggleButton value={0.5}>
                            <Typography sx={{color: '#f9f0e1'}}>Fast</Typography>
                        </ToggleButton>
                        <ToggleButton value={0.8}>
                            <Typography sx={{color: '#f9f0e1'}}>Ultra</Typography>
                        </ToggleButton>
                    </ToggleButtonGroup>
                    </Box>
                    <Box>
                        <Typography variant="h6">Technicals</Typography>
                        <Typography>Pathfinder runtime: {djikstraRunTime}</Typography>
                        <Typography>Nodes Visited: {nodesChecked}</Typography>
                    </Box>
                    <Box>
                        <Typography sx={{display: 'inline'}}>Show Ocean Name</Typography>
                        <Switch checked={showOceanTiles} onClick={handleToggleOceanTiles} />
                        <Typography variant="h6">Notes</Typography>
                        <ul style={{paddingLeft: '1vw', marginTop: '.4vh', marginBottom: '0'}}>
                        <Typography><li>Due to MapBox limitations there are no pacific routes.</li></Typography>
                        <Typography><li>Due to the complex nature of calculating canal access cost, I've chosen not to.</li></Typography>
                        <Typography><li>Apologies to Australian and Indonesians.</li></Typography>
                        <Typography><li>Altering speed mid drawing coudl lead to inaccurate routes</li></Typography>
                        </ul>
                    </Box>
                    
                </Stack>
            </Box>
        </ReactMapGL>
    );
}

export default MainMap;