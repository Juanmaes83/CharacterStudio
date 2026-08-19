import { describe, expect, it, vi } from "vitest"
import * as THREE from "three"
import { CharacterActionAPI } from "../../src/character2027/api/CharacterActionAPI"

function makeRuntime() {
  const root = new THREE.Group()
  const registered = new Set(["IDLE_V2", "WALK_V2", "STOP_V2", "WAVE", "PICK_UP_PHONE"])
  const controller = {
    actions: new Map(Array.from(registered).map((name) => [name, {}])),
    currentState: "IDLE_V2",
    navigation: { target: null, walkSpeed: 0, stopDistance: 0, onArrive: null, mode: "IDLE" },
    has: vi.fn((name) => registered.has(name)),
    playAction: vi.fn((name) => { controller.currentState = name; return name }),
    transitionTo: vi.fn((name) => { controller.currentState = name }),
    stop: vi.fn(() => { controller.currentState = "STOP_V2" }),
    turnTo: vi.fn(),
  }
  const lookAt = { lookAt: vi.fn(), clear: vi.fn() }
  const state = vi.fn()
  const status = vi.fn()
  const targets = {
    PICK_UP_PHONE: {
      approachPoint: new THREE.Vector3(2, 0, 1),
      lookAt: new THREE.Vector3(2, 1.2, 1),
    },
  }
  const api = new CharacterActionAPI({ root, controller, lookAt, interactionTargets: targets, onStateChange: state, onStatus: status })
  return { api, root, controller, lookAt, state, status }
}

describe("CharacterActionAPI", () => {
  it("routes perform through MotionController without changing motion implementation", () => {
    const { api, controller, lookAt, state } = makeRuntime()
    api.perform("WAVE")
    expect(lookAt.clear).toHaveBeenCalledTimes(1)
    expect(controller.playAction).toHaveBeenCalledWith("WAVE", { fadeSeconds: undefined })
    expect(state).toHaveBeenCalledWith("WAVE")
  })

  it("preserves approved Motion Lab moveTo defaults", () => {
    const { api, root, controller, state, status } = makeRuntime()
    root.position.set(0, 0.25, 0)
    api.moveTo([1.5, 0, 0.5], { label: "RIGHT TARGET" })
    expect(controller.transitionTo).toHaveBeenCalledWith("WALK_V2")
    expect(controller.navigation.mode).toBe("WALK_TO")
    expect(controller.navigation.walkSpeed).toBe(0.78)
    expect(controller.navigation.stopDistance).toBe(0.08)
    expect(controller.navigation.target.toArray()).toEqual([1.5, 0.25, 0.5])
    expect(state).toHaveBeenCalledWith("WALK_V2")
    expect(status).toHaveBeenCalledWith("Walking to RIGHT TARGET…")
  })

  it("exposes a serializable command boundary for world integrations", () => {
    const { api, controller } = makeRuntime()
    api.execute({ type: "perform", action: "WAVE" })
    expect(controller.playAction).toHaveBeenCalledWith("WAVE", { fadeSeconds: undefined })

    api.execute({ type: "moveTo", target: [3, 0, -1], options: { label: "terrace" } })
    expect(controller.navigation.target.x).toBe(3)
    expect(controller.navigation.target.z).toBe(-1)
  })

  it("starts semantic interactions through the same public API", () => {
    const { api, controller, lookAt } = makeRuntime()
    api.interact("PICK_UP_PHONE")
    expect(lookAt.lookAt).toHaveBeenCalled()
    expect(controller.transitionTo).toHaveBeenCalledWith("WALK_V2")
    expect(controller.navigation.mode).toBe("WALK_TO")
    expect(controller.navigation.walkSpeed).toBe(0.72)
    expect(controller.navigation.stopDistance).toBe(0.12)
  })

  it("rejects unknown actions and command types clearly", () => {
    const { api } = makeRuntime()
    expect(() => api.perform("DOES_NOT_EXIST")).toThrow("No action registered for DOES_NOT_EXIST")
    expect(() => api.execute({ type: "unknown" })).toThrow("Unsupported CharacterActionAPI command: unknown")
  })
})
