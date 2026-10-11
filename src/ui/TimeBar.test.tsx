import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { TimeBar } from './TimeBar'

function setup(hour = 7.5) {
  const props = {
    hour,
    playing: false,
    scenario: 'weekday' as const,
    rate: 1 as const,
    profile: Array.from({ length: 96 }, (_, i) => i / 96),
    motion: true,
    compact: false,
    onHour: vi.fn(),
    onNudge: vi.fn(),
    onPlay: vi.fn(),
    onScenario: vi.fn(),
    onRate: vi.fn(),
  }
  render(<TimeBar {...props} />)
  return props
}

describe('TimeBar', () => {
  it('exposes the time as a slider with a spoken value', () => {
    setup()
    const slider = screen.getByRole('slider', { name: 'Time of day' })
    expect(slider).toHaveAttribute('aria-valuenow', '450')
    expect(slider).toHaveAttribute('aria-valuetext', '07:30, morning peak')
  })

  it('nudges by five minutes, thirty with shift, and an hour with page keys', async () => {
    const props = setup()
    screen.getByRole('slider').focus()
    await userEvent.keyboard('{ArrowRight}{Shift>}{ArrowLeft}{/Shift}{PageUp}{End}')
    expect(props.onNudge.mock.calls).toEqual([[5], [-30], [60]])
    expect(props.onHour).toHaveBeenCalledWith(24 - 1 / 60)
  })

  it('plays, switches scenario and speed, and jumps to presets', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Play the day forward' }))
    expect(props.onPlay).toHaveBeenCalledWith(true)
    await userEvent.click(screen.getByRole('radio', { name: 'Rain day' }))
    expect(props.onScenario).toHaveBeenCalledWith('rain')
    await userEvent.click(screen.getByRole('button', { name: /Change speed/ }))
    expect(props.onRate).toHaveBeenCalledWith(10)
    await userEvent.click(screen.getByRole('button', { name: /Jump to night/ }))
    expect(props.onHour).toHaveBeenCalledWith(23.5)
  })
})
