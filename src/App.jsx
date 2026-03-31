import React, { useState } from 'react';
import Aioli from '@biowasm/aioli';
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  CircularProgress,
  Chip,
  Box,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Alert
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScienceIcon from '@mui/icons-material/Science';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6',
    },
    secondary: {
      main: '#a78bfa',
    },
    background: {
      default: '#0f111a',
      paper: '#1a1d2d',
    },
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
  },
});

const PIDENT_THRESHOLD = 90; // Ex: 90% identity required
const COVERAGE_THRESHOLD = 70; // Ex: 70% coverage required on both sequences

function App() {
  const [inputSequences, setInputSequences] = useState('>query_1\nCGCATCGATGAAGAACGCAGCGAAATGCGATAAGTAATGTGAATTGCAGAATTCAGTGAATCATCGAATCTTTGAACGCACATTGCGCCCCTTGGTATTCC');
  const [isMapping, setIsMapping] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState(null);
  const [errorText, setErrorText] = useState('');

  const parseFasta = (text) => {
    const sequences = [];
    let currentId = '';
    let currentSeq = '';
    
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('>')) {
        if (currentId) sequences.push({ id: currentId, seq: currentSeq });
        currentId = line.substring(1).trim();
        currentSeq = '';
      } else {
        currentSeq += line.trim().toUpperCase();
      }
    }
    if (currentId) sequences.push({ id: currentId, seq: currentSeq });
    return sequences;
  };

  const handleMap = async () => {
    setErrorText('');
    setResults(null);
    
    const parsed = parseFasta(inputSequences);
    if (parsed.length === 0) {
      setErrorText('No valid FASTA sequence found. Please ensure it starts with ">".');
      return;
    }
    if (parsed.length > 10) {
      setErrorText('Maximum of 10 sequences allowed.');
      return;
    }
    for (const p of parsed) {
      if (p.seq.length > 2000) {
        setErrorText(`Sequence ${p.id} exceeds 2000 bp limit.`);
        return;
      }
    }

    setIsMapping(true);
    setProgressMsg('Initializing Minimap2 module...');
    
    try {
      // Initialize Aioli and Minimap2
      const CLI = await new Aioli({
        tool: 'minimap2',
        version: '2.22'
      });
      
      setProgressMsg('Fetching reference centroids...');
      // In Vite, to fetch something from public dir, we just use the root relative url or base url
      // Since it's deployed to /MortiMap/, Vite handles relative paths if we use import.meta.env.BASE_URL
      const base = import.meta.env.BASE_URL || '/';
      const refRes = await fetch(`${base}references.fasta`);
      if (!refRes.ok) throw new Error('Could not load references.fasta');
      const refText = await refRes.text();
      
      setProgressMsg('Aligning sequences...');
      await CLI.fs.writeFile('references.fasta', refText);
      await CLI.fs.writeFile('query.fasta', inputSequences);
      
      // Execute minimap2 on short reads (-x sr), outputting PAF format
      const output = await CLI.exec('minimap2 -x sr references.fasta query.fasta');
      
      setProgressMsg('Parsing results...');
      
      // Parse output format PAF
      // Columns: query_name, query_len, q_start, q_end, strand, target_name, target_len, t_start, t_end, matches, align_len, mapq
      const lines = output.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('['));
      
      const parsedResults = lines.map(line => {
        const cols = line.split('\t');
        if (cols.length < 12) return null;
        
        const qName = cols[0];
        const qLen = parseInt(cols[1]);
        const tName = cols[5];
        const tLen = parseInt(cols[6]);
        const matches = parseInt(cols[9]);
        const alignLen = parseInt(cols[10]);
        
        const pident = (matches / alignLen) * 100;
        const qCov = (alignLen / qLen) * 100;
        const tCov = (alignLen / tLen) * 100;
        
        const bidirectionalCoverageOk = (qCov >= COVERAGE_THRESHOLD) && (tCov >= COVERAGE_THRESHOLD);
        const pidentOk = pident >= PIDENT_THRESHOLD;
        const mapped = bidirectionalCoverageOk && pidentOk;

        return {
          id: qName,
          reference: tName,
          pident: pident.toFixed(1),
          qCov: qCov.toFixed(1),
          tCov: tCov.toFixed(1),
          status: mapped ? 'Mapped' : 'Unmapped'
        };
      }).filter(Boolean);
      
      // Handle sequences that had zero alignments
      const allIds = parsed.map(p => p.id);
      const mappedIds = new Set(parsedResults.map(p => p.id));
      
      const finalList = [...parsedResults];
      
      // Add unmapped back in manually if Minimap returned nothing for them
      for (const id of allIds) {
        if (!mappedIds.has(id)) {
          finalList.push({
            id: id,
            reference: 'N/A',
            pident: '0.0',
            qCov: '0.0',
            tCov: '0.0',
            status: 'Unmapped'
          });
        }
      }

      setResults(finalList);

    } catch (err) {
      console.error(err);
      setErrorText('Mapping failed. Check console for details: ' + err.message);
    } finally {
      setIsMapping(false);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Box textAlign="center" mb={5}>
          <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom
            sx={{
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2
            }}
          >
            <ScienceIcon fontSize="inherit" sx={{ color: '#60a5fa' }} />
            MortiMap
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Map sequences to ITS2 Centroids using Minimap2 right in your browser.
          </Typography>
        </Box>

        <Card elevation={4} sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            {errorText && (
              <Alert severity="error" sx={{ mb: 3 }}>{errorText}</Alert>
            )}
            
            <TextField
              label="Input DNA Sequences (FASTA)"
              multiline
              rows={8}
              fullWidth
              variant="outlined"
              value={inputSequences}
              onChange={(e) => setInputSequences(e.target.value)}
              placeholder="Paste up to 10 sequences in FASTA format here (max 2000 bp each)..."
              sx={{ fontFamily: 'monospace', mb: 3 }}
            />
            
            <Button
              variant="contained"
              size="large"
              startIcon={isMapping ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleMap}
              disabled={isMapping || !inputSequences.trim()}
              fullWidth
              sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}
            >
              {isMapping ? `Processing: ${progressMsg}` : 'Map to Centroids'}
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Box mt={6}>
            <Typography variant="h5" fontWeight="600" mb={3} sx={{ color: '#e2e8f0' }}>Mapping Dashboard</Typography>
            <TableContainer component={Paper} elevation={4} sx={{ borderRadius: 3, bg: 'background.paper' }}>
              <Table aria-label="mapping results table">
                <TableHead sx={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Query Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Centroid Hit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Identity (%)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Query Cov (%)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Target Cov (%)</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((row, idx) => (
                    <TableRow key={idx} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell component="th" scope="row" sx={{ fontFamily: 'monospace' }}>
                        {row.id}
                      </TableCell>
                      <TableCell>{row.reference}</TableCell>
                      <TableCell align="right">{row.pident}</TableCell>
                      <TableCell align="right">{row.qCov}</TableCell>
                      <TableCell align="right">{row.tCov}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={row.status} 
                          color={row.status === 'Mapped' ? 'success' : 'error'} 
                          variant="filled" 
                          size="small" 
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No results generated.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
