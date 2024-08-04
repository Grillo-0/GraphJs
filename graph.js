/*
 * Copyright Arthur Grillo (c) 2025
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class Vector {
	constructor(x, y) {
		this.x = x
		this.y = y
	}

	static add(a, b) {
		return new Vector(a.x + b.x, a.y + b.y)
	}

	static sub(a, b) {
		return new Vector(a.x - b.x, a.y - b.y)
	}

	static mul(a, b) {
		return new Vector(a.x * b.x, a.y * b.y)
	}

	static addS(v, s) {
		return new Vector(v.x + s, v.y + s)
	}

	static mulS(v, s) {
		return new Vector(v.x * s, v.y * s)
	}

	static divS(v, s) {
		return new Vector(v.x / s, v.y / s)
	}

	static mag(v) {
		return Math.hypot(v.x, v.y)
	}

	static norm(v) {
		return Vector.divS(v, Vector.mag(v))
	}

	static rand() {
		return new Vector(Math.random(), Math.random())
	}
}

export class Node {
	constructor(label) {
		this.label = label
		this.peers = []
		this.pos = new Vector(0, 0)
		this.vel = new Vector(0, 0)
		this.acel = new Vector(0, 0)
	}

	addPeer(node) {
		this.peers.push(node)
	}
}

export class Edge {
	constructor(start, end, is_directed) {
		this.start = start
		this.end = end
		this.is_directed = is_directed
	}
}

export class CanvasGraphDrawer {
	constructor(canvas) {
		this.canvas = canvas
		this.canvas.width = this.canvas.clientWidth
		this.canvas.height = this.canvas.clientHeight
		window.addEventListener('resize', e => {
			const prev_transform = ctx.getTransform()
			this.canvas.width = this.canvas.clientWidth
			this.canvas.height = this.canvas.clientHeight
			this.ctx.setTransform(prev_transform)
		})

		this.canvas.addEventListener('mousemove', e => {
			if (e.buttons === 1) {
				const transform = this.ctx.getTransform()
				this.ctx.translate(
					e.movementX / transform.a,
					e.movementY / transform.d
				)
			}
		})

		this.canvas.addEventListener('wheel', e => {
			let scale = 1e-2;
			if (e.deltaY < 0) {
				scale += 1
			} else {
				scale = 1 - scale
			}

			const transform = this.ctx.getTransform()
			transform.scaleSelf(
				scale,
				scale,
				1,
				(e.x - transform.e) / transform.a,
				(e.y - transform.f) / transform.d
			)
			this.ctx.setTransform(transform)
		})


		this.ctx = canvas.getContext("2d")
	}

	getWidth() {
		return this.canvas.width
	}

	getHeight() {
		return this.canvas.height
	}

	drawNode(node) {
		this.ctx.beginPath()
		this.ctx.arc(node.pos.x, node.pos.y, 5, 0, 2 * Math.PI)
		this.ctx.stroke()
		this.ctx.fillText(node.label, node.pos.x + 5, node.pos.y)
	}


	drawEdge({start, end, is_directed}) {
		const dir = Vector.sub(end.pos, start.pos)
		const angle = Math.atan2(dir.y, dir.x)

		const draw_start = new Vector(start.pos.x + 5 * Math.cos(angle),
					      start.pos.y + 5 * Math.sin(angle))
		const draw_end = new Vector(end.pos.x - 5 * Math.cos(angle),
					    end.pos.y - 5 * Math.sin(angle))
		this.ctx.beginPath()
		this.ctx.moveTo(draw_start.x, draw_start.y)
		this.ctx.lineTo(draw_end.x, draw_end.y)
		this.ctx.stroke()

		if (is_directed) {
			this.ctx.save()
			const prev_transform = this.ctx.transform;

			this.ctx.translate(draw_end.x, draw_end.y)
			this.ctx.scale(5, 5)
			this.ctx.rotate(angle - Math.PI / 2)
			this.ctx.fillStyle = 'blue'

			this.ctx.beginPath()
			this.ctx.moveTo(-.5, -1)
			this.ctx.lineTo(0.5, -1)
			this.ctx.lineTo(0, 0)
			this.ctx.lineTo(-.5, -1)
			this.ctx.fill()

			this.ctx.restore()
		}
	}

	clearScreen() {
		const prev_transform = this.ctx.getTransform()
		this.ctx.resetTransform()
		this.ctx.clearRect(0,0, this.canvas.width, this.canvas.height)
		this.ctx.setTransform(prev_transform)
	}
}

export class Graph {
	constructor() {
		this.nodes = new Map()
		this.edges = new Array()
		this.spring_constant = 1e2
		this.spring_length = 30
		this.repulsive_constant = 1e5
		this.max_repulsive_force = 1e4
	}

	addNode(node) {
		if (!(node instanceof Node))
			throw new Error("node must a be from the Node class")

		this.nodes.set(node.label, node)

		return node
	}

	getNode(label) {
		const node = this.nodes.get(label)

		if (node === undefined)
			throw new Error(`node with label "${label}" doesn't exist on this graph`)

		return node
	}

	connectNodes(node_a_label, node_b_label, is_directed = false) {
		const node_a = this.getNode(node_a_label)
		const node_b = this.getNode(node_b_label)

		const new_edge = new Edge(node_a, node_b, is_directed)

		if (this.edges.find( e => e === new_edge) != undefined)
			return

		this.edges.push(new_edge)
		node_a.addPeer(node_b)
		if (!is_directed)
			node_b.addPeer(node_a)
	}

	init(graphDrawer) {
		for (const n of this.nodes.values()) {
			n.pos = Vector.rand()
			n.pos = Vector.mulS(n.pos, .1)
			n.pos = Vector.addS(n.pos, (1-.1)/ 2)
			n.pos = Vector.mul(
				n.pos,
				new Vector(graphDrawer.getWidth(), graphDrawer.getHeight())
			)
		}
	}

	simulate(graphDrawer, dt) {
		for (const n of this.nodes.values()) {
			n.acel = new Vector(0, 0)
		}

		for (const edge of this.edges) {
			const n = edge.start
			const p = edge.end
			const dist_vec = Vector.sub(n.pos, p.pos)
			const dist = Vector.mag(dist_vec)
			const dir = Vector.norm(dist_vec)

			if (dist > this.spring_length) {
				n.acel = Vector.sub(n.acel, Vector.mulS(dir, this.spring_constant * Math.log(dist - (this.spring_length - 1))))
				p.acel = Vector.add(p.acel, Vector.mulS(dir, this.spring_constant * Math.log(dist - (this.spring_length - 1))))
			}

		}

		for (const n of this.nodes.values()) {
			for (const p of this.nodes.values()) {
				if (n === p)
					continue

				const dist_vec = Vector.sub(p.pos, n.pos)
				const dist = Vector.mag(dist_vec)
				const dir = Vector.norm(dist_vec)

				let force
				if (dist != 0)
					force = Vector.sub(n.acel, Vector.mulS(dir, this.repulsive_constant / (dist * dist) ))
				else {
					force = Vector.mulS(Vector.norm(force), this.max_repulsive_force)
				}

				if (Vector.mag(force) > this.max_repulsive_force) {
					force = Vector.mulS(Vector.norm(force), this.max_repulsive_force)
				}

				n.acel = force
			}

			const dist_vec = Vector.sub(
				new Vector(
					graphDrawer.getWidth() / 2,
					graphDrawer.getHeight() / 2
				),
				n.pos
			)
			const dist = Vector.mag(dist_vec)
			const dir = Vector.norm(dist_vec)
			if (dist != 0)
				n.acel = Vector.add(n.acel, Vector.mulS(dir, 1e-3 * (dist * dist)))
		}

		for (const n of this.nodes.values()) {
			n.pos = Vector.add(n.pos, Vector.mulS(n.vel, dt))
			n.vel = Vector.add(n.vel, Vector.mulS(n.acel, dt))

			n.vel = Vector.mulS(n.vel, 0.95)
		}
	}

	draw(graphDrawer) {
		graphDrawer.clearScreen();

		for (const edge of this.edges) {
			graphDrawer.drawEdge(edge)
		}

		for (const n of this.nodes.values()) {
			graphDrawer.drawNode(n)
		}
	}

	display(graphDrawer) {
		this.init(graphDrawer)
		this.draw(graphDrawer)

		this.draw(graphDrawer)
		const step = (prev) => {
			window.requestAnimationFrame((t) => {
				var dt = (t - prev) / 1000
				if (dt > 0.5)	
					dt = 0
				this.simulate(graphDrawer, dt)
				this.draw(graphDrawer)
				step(t)
			})
		}
		step(document.timeline.currentTime)
	}
}
