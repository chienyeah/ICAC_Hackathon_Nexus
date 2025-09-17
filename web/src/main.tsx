import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { config } from './lib/web3'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={config}><App/></WagmiProvider>
)
