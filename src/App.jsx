import { useState, useEffect } from 'react'
import { db } from './services/firebaseConnection'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx';

const listRef = collection(db, 'conferencias')

function App() {
  const [ lojas, setLojas ] = useState([])
  const [ lojaSelecionada, setLojaSelecionada ] = useState('')
  const [ dadosLoja, setDadosLoja ] = useState(null)

  // 1. Buscar lojas/arquivos ao carregar
  useEffect(() => {
    async function buscarLojas() {
      try {
        const snapshot = await getDocs(listRef)
        const lojasDisponiveis = snapshot.docs.map(doc => ({
          id: doc.id,
          loja: doc.data().loja
        }))
        setLojas(lojasDisponiveis)
      } catch (err) {
        console.error('Erro ao buscar lojas:', err)
      }
    }
    buscarLojas()
  }, [])

  // 2. Buscar dados da loja selecionada
  async function handleSelecionaLoja(e) {
    const lojaId = e.target.value
    setLojaSelecionada(lojaId)
    if (lojaId) {
      try {
        const docRef = doc(db, 'conferencias', lojaId)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          console.log(docSnap.data())
          setDadosLoja(docSnap.data())
        } else {
          setDadosLoja(null)
        }
      } catch (err) {
        setDadosLoja(null)
      }
    } else {
      setDadosLoja(null)
    }
  }

  // Função para baixar o resultado em XLSX
  function exportResultado(sobrando, faltando) {
    const wb = XLSX.utils.book_new();
    const wsSobrando = XLSX.utils.json_to_sheet(sobrando);
    const wsFaltando = XLSX.utils.json_to_sheet(faltando);
    XLSX.utils.book_append_sheet(wb, wsSobrando, 'Sobrando');
    XLSX.utils.book_append_sheet(wb, wsFaltando, 'Faltando');
    XLSX.writeFile(wb, 'resultado_conferencia.xlsx');
  }

  // 3. Processar arquivo XLSX e comparar com dados do Firebase
  function handleXLSX(e) {
    const file = e.target.files[ 0 ]
    if (!file || !dadosLoja) {
      alert('Selecione uma loja antes de carregar o arquivo!')
      return
    }
    const reader = new FileReader()
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target.result, { type: 'binary' })
      const sheetName = workbook.SheetNames[ 0 ]
      const worksheet = workbook.Sheets[ sheetName ]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      const contagemArquivo = {}
      data.forEach((row, idx) => {
        if (idx === 0) return
        const codigo = row[ 2 ]
        if (codigo) {
          contagemArquivo[ codigo ] = (contagemArquivo[ codigo ] || 0) + 1
        }
      })
      const contagemFirebase = {}
      if (Array.isArray(dadosLoja.texto)) {
        dadosLoja.texto.forEach(codigo => {
          if (codigo) {
            contagemFirebase[ codigo ] = (contagemFirebase[ codigo ] || 0) + 1
          }
        })
      }
      const sobrando = []
      const faltando = []
      const todosCodigos = new Set([
        ...Object.keys(contagemFirebase),
        ...Object.keys(contagemArquivo)
      ])
      todosCodigos.forEach(codigo => {
        const qFirebase = contagemFirebase[ codigo ] || 0
        const qArquivo = contagemArquivo[ codigo ] || 0
        if (qFirebase > qArquivo) {
          sobrando.push({ codigo, quantidade_loja: qFirebase, quantidade_arquivo: qArquivo, sobrando: qFirebase - qArquivo })
        } else if (qFirebase < qArquivo) {
          faltando.push({ codigo, quantidade_loja: qFirebase, quantidade_arquivo: qArquivo, faltando: qArquivo - qFirebase })
        }
      })
      exportResultado(sobrando, faltando)
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Conferência de Estoque</h2>
      {/* 2. Select de loja */}
      <span>Escolha a loja:</span>
      <br />
      <select value={lojaSelecionada} onChange={handleSelecionaLoja}>
        <option value=''>Selecione...</option>
        {lojas.map(loja => (
          <option key={loja.id} value={loja.id}>{loja.loja}</option>
        ))}
      </select>
      <br />
      {
        (lojaSelecionada) && <span>Por favor selecione o arquivo .xlsx</span>
      }

      {/* {dadosLoja && (
        <div style={{ margin: '16px 0' }}>
          <strong>Dados da loja selecionada:</strong>
          <pre style={{ background: '#eee', padding: 8 }}>{JSON.stringify(dadosLoja, null, 2)}</pre>
        </div>
      )} */}
      {/* 3. Upload do arquivo XLSX */}
      <div style={{ margin: '16px 0' }}>
        <span>Carregue o arquivo .xlsx:</span>
        <br />
        <input type='file' accept='.xlsx' onChange={handleXLSX} />
      </div>
      <div>
        <small>O resultado será baixado automaticamente após o upload do arquivo.</small>
      </div>
    </div>
  )
}

export default App
