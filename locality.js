//
// const cy = cytoscape({
//   // container: document.getElementById('cy'),
//   elements: [
//     { data: { id: 'A' } },
//     { data: { id: 'B' } },
//     { data: { id: 'A-B', source: 'A', target: 'B' } }
//   ]
// });


class LocalityGraph {
    constructor() {
        this.cy = cytoscape({
            container: document.getElementById('cy'),  // Attach to the div
            elements: [],  // Empty graph initially
            style: [  // Define styles
                {
                    selector: 'node',
                    style: {
                        'background-color': '#0074D9',
                        'label': 'data(id)',
                        'width': 20,
                        'height': 20,
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#AAAAAA'
                    }
                }
            ],
            layout: {
                name: 'cose',  // Force-directed layout
                animate: true
            }
        });
    }

    visualize_graph_animate() {
        this.cy.layout({ name: 'cose', animate: true }).run(); // Recalculate layout
    }

    visualize_graph() {
        this.cy.layout({ name: 'cose', animate: false }).run(); // Recalculate layout
    }

    add_node(human) {
        if (PARAMS.localityMode == 'ring') this.add_node_ring(human);
        else this.add_node_triangle(human);
    }


    add_node_ring(human) {
        const nodes = this.cy.nodes(); // Get all nodes
        let edges_to_add = [];
        if (nodes.length > 0) {
            let neighbor_id = nodes[randomInt(nodes.length)].id();
            if (nodes.length > 1) {
                // should always have at least one neighbor
                let neighbors_neighbor_id = this.get_neighbors(neighbor_id)[0].id();
                if (nodes.length > 2) {
                    this.cy.$(`edge[source="${neighbor_id}"][target="${neighbors_neighbor_id}"]`).remove();
                    this.cy.$(`edge[source="${neighbors_neighbor_id}"][target="${neighbor_id}"]`).remove();
                }
                edges_to_add.push(neighbors_neighbor_id);
            }
            edges_to_add.push(neighbor_id);
        }
        this.cy.add({
            group: 'nodes',
            data: { id: human.id, ref: human }
        });
        edges_to_add.forEach(new_neighbor_id => {
            this.cy.add({group: 'edges', data: {source: human.id, target: new_neighbor_id}});
        });
    }


    add_node_triangle(human) {
        let first_neighbors = [];
        let second_neighbors = [];
        const nodes = this.cy.nodes(); // Get all nodes

        // Pick first neighbors randomly
        for (let i = 0; i < Math.min(nodes.length, PARAMS.numFirstNeighbors); i++) {
            let first_neighbor = nodes[randomInt(nodes.length)].id();
            let neighbors_of_neighbor = shuffleArray(this.get_neighbors(first_neighbor).map(n => n.id()));

            // Pick second neighbors randomly
            for (let j = 0; j < Math.min(neighbors_of_neighbor.length, PARAMS.numSecondNeighbors); j++) {
                let second_neighbor = neighbors_of_neighbor[j];
                second_neighbors.push(second_neighbor);
            }

            first_neighbors.push(first_neighbor);
        }

        this.cy.add({
            group: 'nodes',
            data: { id: human.id, ref: human }
        });

        first_neighbors.forEach(neighbor => {
            this.cy.add({ group: 'edges', data: { source: human.id, target: neighbor } });
        });
        second_neighbors.forEach(neighbor => {
            this.cy.add({ group: 'edges', data: { source: human.id, target: neighbor } });
        });
    }

    delete_node(id) {
        if (PARAMS.localityMode == 'ring') this.delete_node_ring(id);
        else this.delete_node_triangle(id);
    }

    delete_node_ring(id) {
        const nodes = this.cy.nodes(); // Get all nodes
        if (nodes.length > 3) {
            let neighbors = this.get_neighbors(id);
            let n1 = neighbors[0].id();
            let n2 = neighbors[1].id();
            this.cy.add({ group: 'edges', data: { source: n1, target: n2 } });
        }
        this.cy.getElementById(id).remove();
    }

    delete_node_triangle(id) {
        this.cy.getElementById(id).remove();
    }

    get_neighbors(id) {
        return this.cy.getElementById(id).neighborhood('node');
    }
}


