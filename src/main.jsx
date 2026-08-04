import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/baloo-2/500.css'
import '@fontsource/baloo-2/600.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/baloo-2/800.css'
import App from './App.jsx'
import './styles.css'

class Boundary extends React.Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) {
      return <pre style={{ color: '#f87171', padding: 20, whiteSpace: 'pre-wrap' }}>
        {String(this.state.err && (this.state.err.stack || this.state.err.message || this.state.err))}
      </pre>
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>
)
