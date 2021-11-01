
// Min Heap
class MinHeap {
    constructor() {
        this.data = [];
    }

    insert = (value) => {
        this.data.push(value);
        this.bubbleUp(this.data.length - 1);
    }

    bubbleUp = (index) => {
        while (index > 0) {
            var parent = Math.floor((index + 1) / 2 ) - 1;

            if (this.data[parent] > this.data[index]) {
                var temp = this.data[parent];
                this.data[parent] = this.data[index];
                this.data[index] = temp;
            }

            index = parent;
        }
    };

    getMin = () => {
        return this.data[0];
    };

    popMin = () => {
        var temp = this.data[0];
        this.data.shift();
        return temp;
    }

    getSize = () => {
        return this.data.length;
    }

    bubbleDown = (index) => {
        while (true) {
            var child = (index + 1) * 2;
            var sibling = child - 1;
            var toSwap = null;

            if (this.data[index] > this.data[child]) {
                toSwap = child;
            }

            if (this.data[index] > this.data[sibling] && (this.data[child] == null || (this.data[child] !== null && this.data[sibling] < this.data[child]))) {
                toSwap = sibling;
            }

            if (toSwap == null) {
                break;
            }

            var temp = this.data[toSwap];
            this.data[toSwap] = this.data[index];
            this.data[index] = temp;
            index = toSwap;
        }
    };
}

var coordinate = [[]];
var adjacent = [[]];
let pathToNode = new Map();
let distanceToNode = new Map();
let timeToNode = new Map();
let costToNode = new Map();
let nodesChecked = 0;

// Djikstra
export const getRoute = (start, end, coordinateMap, adjacentMap, speed, costPerDay, shipClass) => {
    coordinate = coordinateMap;
    adjacent = adjacentMap;
    let path = [];
    pathToNode = new Map();
    distanceToNode = new Map();
    timeToNode = new Map();
    costToNode = new Map();
    nodesChecked = 0;
    djikstra(start, path, speed, costPerDay, shipClass, 0, 0, 0);
    return pathToNode.has(end) ? [pathToNode.get(end), distanceToNode.get(end), timeToNode.get(end), costToNode.get(end), nodesChecked] : null;
}

// shipClass
// 1 = feeder
// 2 = panamax
const djikstra = (currentLocation, path, speed, costPerDay, shipClass, distance, cost, time) => {
    nodesChecked += 1;                                          // Stores how many nodes were visited in this search
    let pathHere = [].concat(path);                             // Stores route taken to get to currentLocation
    pathHere.push(currentLocation);                             // Add currentLocation to path

    pathToNode.set(currentLocation, pathHere);                  // Stores the path in a "global" dataset
    distanceToNode.set(currentLocation, distance);              // Stores distance taken to get to currentLocation
    timeToNode.set(currentLocation, time);                      // Stores time taken to get to currentLocation
    costToNode.set(currentLocation, cost);                      // Stores cost to get to currentLocation

    let thisLatitude = coordinate.get(currentLocation)[1];      // Gets currentLocations latitude
    let thisLongitude = coordinate.get(currentLocation)[0];     // Gets currentLocations longitude

    let minQueue = new MinHeap();
    let distanceToAdjacent = new Map();                         // Key->Value of distance->adjacentnode
    let timeToAdjacent = new Map();                             // Key->Value of timeTaken->adjacentnode
    let costToAdjacent = new Map();                             // Key->Value of cost->adjacentNode

    let nodeGetDistance = new Map();                            // Key->Value of adjacentnode->distance
    let nodeGetTime = new Map();                                // Key->Value of adjacentnode->timeTaken
    let nodeGetCost = new Map();                                // Key->Value of adjacentnode->cost

    let adjacentNodes = adjacent.get(currentLocation);          // Array of all adjacent nodes from currentLocation

    adjacentNodes.forEach(node => {
        let canalAccess = getCanalAccess(currentLocation, node);
        if (shipClass > 1 && canalAccess === "Kiel") {} // Do nothing, only shipClass 1 can pass through Kiel Canal
                                                        // Need to figure out shipClass levels for Suez and Panama Currently ignoring
        else {
            // Gets coordinates of node being checked
            let nextLatitude = coordinate.get(node)[1];
            let nextLongitude = coordinate.get(node)[0];

            // Calculates distance to nextNode in meters and stores key->value of eachother
            let nextDistance = getDistanceHaversine(thisLatitude, thisLongitude, nextLatitude, nextLongitude);
            distanceToAdjacent.set(nextDistance, node);
            nodeGetDistance.set(node, nextDistance);

            // Calculates travelTime to nextNode in hours and stores key->value of eachother
            let travelTime = (nextDistance / speed) / 3600; // Travel time converted to hours
            timeToAdjacent.set(travelTime, node);
            nodeGetTime.set(node, travelTime);

            // Calculates cost to nextNode in USD and stores key->value of eachother
            let travelCost = (costPerDay / 24) * travelTime; // Cost needs to be measured in costPerHour of ship sailing + Handle canals
            costToAdjacent.set(travelCost, node);
            nodeGetCost.set(node, travelCost);

            minQueue.insert(travelCost);
        }
    })

    while (minQueue.getSize() > 0) {
        let currentNode = costToAdjacent.get(minQueue.getMin());
        let totalTime = time;
        let canalAccess = getCanalAccess(currentLocation, currentNode);
        if (canalAccess === "None") { totalTime += nodeGetTime.get(currentNode); }
        else if (canalAccess === "Kiel" ) { totalTime += 8; }       // Average 8 hours to traverse Kiel
        else if (canalAccess === "Suez" ) { totalTime += 14; }      // Average 14 hours to traverse Suez
        else if (canalAccess === "Panama" ) {totalTime += 9; }      // Average 9 hours to traverse Panama
        let totalCost = cost + nodeGetCost.get(currentNode);
        let totalDistance = distance + nodeGetDistance.get(currentNode);
        // If node is not visited, or worth visiting, visit
        if (!costToNode.has(currentNode) || costToNode.get(currentNode) > totalCost) { djikstra(currentNode, pathHere, speed, costPerDay, shipClass, totalDistance, totalCost, totalTime);  }
        minQueue.popMin();
    }
}

const getCanalAccess = (from, to) => {
    if ((from === "Sea of Hamburg" && to === "Kiel Canal") || (from === "Kiel Canal" && to === "Sea of Hamburg")) { return "Kiel"; }
    else if ((from === "North Suez" && to === "South Suez") || (from === "South Suez" && to === "North Suez")) { return "Suez"; }
    else if ((from === "Upper Panama" && to === "Lower Panama") || (from === "Lower Panama" && to === "Upper Panama")) { return "Panama"; }
    else { return "None"; }
}










// returns the straight distance between two coordinates in metres. Using Haversine formula. Slight efficiency boost over Cosine method.
const getDistanceHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres
    return d;
}
