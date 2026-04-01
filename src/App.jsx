import React, { useState } from 'react';
import Aioli from '@biowasm/aioli';
import { parseFasta, selectBestHits } from './utils';
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

const PIDENT_THRESHOLD = 98; // Ex: 90% identity required
const COVERAGE_THRESHOLD = 99; // Ex: 70% coverage required on both sequences

function App() {
  const [inputSequences, setInputSequences] = useState('>query_1\nCGCATCGATGAAGAACGCAGCGAAATGCGATAAGTAATGTGAATTGCAGAATTCAGTGAATCATCGAATCTTTGAACGCACATTGCGCCCCTTGGTATTCC');
  const [isMapping, setIsMapping] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState(null);
  const [errorMessages, setErrorMessages] = useState([]);



  const handleMap = async () => {
    setErrorMessages([]);
    setResults(null);

    const { sequences, errors: parsingErrors } = parseFasta(inputSequences);
    const validationErrors = [...parsingErrors];

    if (sequences.length === 0 && validationErrors.length === 0) {
      validationErrors.push('No valid FASTA sequence found. Please ensure it starts with ">".');
    }

    const ids = new Set();
    for (const p of sequences) {
      if (ids.has(p.id)) {
        validationErrors.push(`Duplicate ID found: ${p.id}`);
      }
      ids.add(p.id);
    }

    if (sequences.length > 10) {
      validationErrors.push('Maximum of 10 sequences allowed.');
    }

    for (const p of sequences) {
      if (p.seq.length > 2000) {
        validationErrors.push(`Sequence ${p.id} exceeds 2000 bp limit. This service focuses on ITS2 region only.`);
      }
    }

    if (validationErrors.length > 0) {
      setErrorMessages(validationErrors);
      return;
    }

    setIsMapping(true);
    setProgressMsg('Initializing Minimap2 module...');

    try {
      // Initialize Aioli and Minimap2
      const CLI = await new Aioli({
        tool: 'minimap2',
        version: '2.22'
      });

      setProgressMsg('Fetching reference sequences...');
      // In Vite, to fetch something from public dir, we just use the root relative url or base url
      // Since it's deployed to /MortiMap/, Vite handles relative paths if we use import.meta.env.BASE_URL
      const base = import.meta.env.BASE_URL || '/';
      const refRes = await fetch(`${base}references.fasta`);
      if (!refRes.ok) throw new Error('Could not load references.fasta');
      const refText = await refRes.text();

      setProgressMsg('Aligning sequences...');
      await CLI.fs.writeFile('references.fasta', refText);

      // Minimap2 truncates sequence IDs at the first whitespace.
      // To preserve full IDs, we map them to safe internal IDs and translate back later.
      const idMap = {};
      const safeQueryFasta = sequences.map((s, idx) => {
        const safeId = `seq_${idx}`;
        idMap[safeId] = s.id;
        return `>${safeId}\n${s.seq}`;
      }).join('\n');

      await CLI.fs.writeFile('query.fasta', safeQueryFasta);

      // Execute minimap2 on short reads (-x sr), outputting PAF format
      const output = await CLI.exec('minimap2 -k 10 -w 1 -N 5 references.fasta query.fasta');

      setProgressMsg('Parsing results...');

      // Parse output format PAF
      // Columns: query_name, query_len, q_start, q_end, strand, target_name, target_len, t_start, t_end, matches, align_len, mapq
      console.log(output);
      const lines = output.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('['));

      const allAlignments = lines.map(line => {
        const cols = line.split('\t');
        if (cols.length < 12) return null;

        const qIdSafe = cols[0];
        const qName = idMap[qIdSafe] || qIdSafe;
        const qLen = parseInt(cols[1]);
        const tName = cols[5];
        const tLen = parseInt(cols[6]);
        const matches = parseInt(cols[9]);
        const alignLen = parseInt(cols[10]);

        const pident = (matches / alignLen) * 100;
        const qCov = (alignLen / qLen) * 100;
        const tCov = (alignLen / tLen) * 100;

        return {
          id: qName,
          reference: tName,
          pidentNum: pident,
          qCovNum: qCov,
          tCovNum: tCov,
        };
      }).filter(Boolean);

      const bestHitsMap = selectBestHits(allAlignments);

      // Generate final results list based on all queried sequences
      const finalList = sequences.map(s => {
        const bestHit = bestHitsMap.get(s.id);
        if (bestHit) {
          const mapped = (bestHit.pidentNum >= PIDENT_THRESHOLD) &&
            (bestHit.qCovNum >= COVERAGE_THRESHOLD) &&
            (bestHit.tCovNum >= COVERAGE_THRESHOLD);
          return {
            id: s.id,
            reference: bestHit.reference,
            pident: bestHit.pidentNum.toFixed(1),
            qCov: bestHit.qCovNum.toFixed(1),
            tCov: bestHit.tCovNum.toFixed(1),
            status: mapped ? 'Mapped' : 'Unmapped'
          };
        }
        // Case where sequence had zero alignments
        return {
          id: s.id,
          reference: 'N/A',
          pident: '0.0',
          qCov: '0.0',
          tCov: '0.0',
          status: 'Unmapped'
        };
      });

      setResults(finalList);

    } catch (err) {
      console.error(err);
      setErrorMessages(['Mapping failed. Check console for details: ' + err.message]);
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
            Map your ITS2 sequences to representative sequences of <i>Mortierellacea</i> dark taxa clusters.
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Cite our paper: <i>Dziurzynski et al. 2026</i>
          </Typography>
        </Box>

        <Card elevation={4} sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            {errorMessages.length > 0 && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {errorMessages.map((msg, index) => (
                    <li key={index}>{msg}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <TextField
              label="Input DNA Sequences (FASTA)"
              multiline
              rows={2}
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
              {isMapping ? `Processing: ${progressMsg}` : 'Map to Representatives'}
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
                    <TableCell sx={{ fontWeight: 'bold' }}>Cluster Hit</TableCell>
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
