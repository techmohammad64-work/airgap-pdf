import './styles/global.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { initStatus } from './lib/status.svelte'

initStatus()
mount(App, { target: document.getElementById('app')! })
