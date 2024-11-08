import { useState, useRef, useEffect } from "react";
import InputBox from "./InputBox";
import TaikoNode from "./TaikoNode";
import ErrorModal from "./ErrorModal";
import LargeArcEdge from "./LargeArcEdge";

import { generateColor } from './utils/colorUtils';
import { drawConnections } from "./utils/drawingUtils"; 
import { checkAndGroupConnections } from "./utils/MergeUtils"; 



import clickSound from "./assets/sound effect/Click.wav";
import errorSound from "./assets/sound effect/Error.wav";
import connectSound from "./assets/sound effect/Connection.wav";

const edgeTypes = {
  custom: LargeArcEdge, // Register custom arc edge type
};

function App() {
  const [topRowCount, setTopRowCount] = useState(1);
  const [bottomRowCount, setBottomRowCount] = useState(1);
  const [showNodes, setShowNodes] = useState(true);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [edgeState, setEdgeState] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const svgRef = useRef(null);

  const [progress, setProgress] = useState(0);

  const clickAudio = new Audio(clickSound);
  const errorAudio = new Audio(errorSound);
  const connectAudio = new Audio(connectSound);

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const [currentColor, setCurrentColor] = useState(0);


  // store the pair of edges
  const [connectionPairs, setConnectionPairs] = useState([]);

  const [connectionGroups, setConnectionGroups] = useState([]);
  const groupMapRef = useRef(new Map());


  useEffect(() => {
    drawConnections(svgRef, connections, connectionPairs);
  }, [connectionGroups, connections, topRowCount, bottomRowCount, connectionPairs]);

  useEffect(() => {
    checkAndAddNewNodes();
  }, [connections, topRowCount, bottomRowCount]);

  useEffect(() => {
    //console.log("CONNECTION PAIRS:", connectionPairs);
  }, [connectionPairs]);

  useEffect(() => {
    calculateProgress();
  }, [connections, topRowCount, bottomRowCount]);

  useEffect(() => {
    const handleResize = () => {
      drawConnections(svgRef, connections, connectionPairs); // Pass parameters
    };
  
    window.addEventListener('resize', handleResize);
  
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [svgRef, connections, connectionPairs]); // Add svgRef to dependencies
  

  useEffect(() => {
    const latestPair = connectionPairs[connectionPairs.length - 1];
    if (latestPair && latestPair.length === 2) {
      checkAndGroupConnections(
        latestPair,
        groupMapRef,
        setConnectionGroups,
        connections,
        setConnections
      );
    }
  }, [connectionPairs]);
  

  const checkAndAddNewNodes = () => {
    const allTopNodesConnected = Array.from({ length: topRowCount }, (_, i) =>
      connections.some((conn) => conn.nodes.includes(`top-${i}`))
    ).every(Boolean);

    const allBottomNodesConnected = Array.from(
      { length: bottomRowCount },
      (_, i) => connections.some((conn) => conn.nodes.includes(`bottom-${i}`))
    ).every(Boolean);

    if (allTopNodesConnected || allBottomNodesConnected) {
      if (allTopNodesConnected) {
        setTopRowCount((prev) => prev + 1);
      } else {
        setBottomRowCount((prev) => prev + 1);
      }
    }
  };

  const createTopRow = (count) => {
    return Array.from({ length: count }, (_, i) => (
      <>
        <TaikoNode
          key={`top-${i}`}
          id={`top-${i}`}
          onClick={() => handleNodeClick(`top-${i}`)}
          isSelected={selectedNodes.includes(`top-${i}`)}
          index={i}
          totalCount={topRowCount}
        />
      </>
    ));
  };

  const createBottomRow = (count) => {
    return Array.from({ length: count }, (_, i) => (
      <TaikoNode
        key={`bottom-${i}`}
        id={`bottom-${i}`}
        onClick={() => handleNodeClick(`bottom-${i}`)}
        isSelected={selectedNodes.includes(`bottom-${i}`)}
        index={i}
        totalCount={bottomRowCount}
      />
    ));
  };

  const handleNodeClick = (nodeId) => {
    setErrorMessage("");
    connectAudio.play();
    if (selectedNodes.includes(nodeId)) {
      setSelectedNodes(selectedNodes.filter((id) => id !== nodeId));
    } else {
      if (selectedNodes.length < 2) {
        const newSelectedNodes = [...selectedNodes, nodeId];
        setSelectedNodes(newSelectedNodes);
        if (newSelectedNodes.length === 2) {
          tryConnect(newSelectedNodes);
        }
      }
    }
  };

  

  const tryConnect = (nodes) => {
    if (nodes.length !== 2) return;
    const [node1, node2] = nodes;
    const isTopNode = (id) => id.startsWith("top");
    const isBottomNode = (id) => id.startsWith("bottom");

    if (
      (isTopNode(node1) && isTopNode(node2)) ||
      (isBottomNode(node1) && isBottomNode(node2))
    ) {
      errorAudio.play();
      setErrorMessage("Can't connect two nodes from the same row.");
      setSelectedNodes([]);
      return;
    }

    const isDuplicate = connections.some(
      (conn) =>
        (conn.nodes.includes(node1) && conn.nodes.includes(node2)) ||
        (conn.nodes.includes(node2) && conn.nodes.includes(node1))
    );
  
    if (isDuplicate) {
      errorAudio.play();
      setErrorMessage("These nodes are already connected.");
      setSelectedNodes([]);
      return;
    }

    if (
      edgeState && (edgeState.nodes.includes(node1) || edgeState.nodes.includes(node2))
    ) {
      errorAudio.play();
      setErrorMessage(
        "Two vertical edges in each pair should not share a common vertex"
      );
      setSelectedNodes([]);
      return;
    }

    let newColor;
    if (edgeState) {
      // If there is a pending edge, use the same color and create a pair
      newColor = edgeState.color;
      const newConnection = {
        nodes: nodes,
        color: newColor,
      };
      setConnections([...connections, newConnection]);
      setConnectionPairs((prevPairs) => {
        const lastPair = prevPairs[prevPairs.length - 1];
        let updatedPairs;
        if (lastPair && lastPair.length === 1) {
          // If the last pair has one connection, complete it
          updatedPairs = [...prevPairs.slice(0, -1), [...lastPair, newConnection]];
        } else {
          // Otherwise, create a new pair
          updatedPairs = [...prevPairs, [edgeState, newConnection]];
        }
        return updatedPairs;
  
      });
      console.log(connectionPairs);
      setEdgeState(null);
    } else {
      // If no pending edge, create a new edge and add to edgeState
      newColor = generateColor(currentColor, setCurrentColor);
      console.log("newColor: ", newColor);
      //console.log(newColor);
      const newConnection = {
        nodes: nodes,
        color: newColor,
      };
      setConnections([...connections, newConnection]);
      // Create a new pair and add to the connection pairs
      setConnectionPairs([...connectionPairs, [newConnection]]);
      setEdgeState(newConnection);
    }
    setSelectedNodes([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowNodes(true);
    setConnections([]);
    setSelectedNodes([]);
    setErrorMessage("");
  };

  const handleClear = () => {
    setConnectionPairs([])
    setConnections([]);
    setSelectedNodes([]);
    setBottomRowCount(1);
    setTopRowCount(1);
    setEdgeState(null);
    setErrorMessage("");
    setProgress(0);
    setConnectionGroups([]);
    setCurrentColor(0);
    groupMapRef.current.clear();
    console.log(connectionPairs);
  };
  
  const calculateProgress = () => {
    let totalPossibleConnections = (topRowCount - 1) *  (bottomRowCount - 1);
    if (totalPossibleConnections % 2 !== 0) {
      totalPossibleConnections -= 1;
    }
    const verticalEdges = connections.length;
    const progressPercentage = totalPossibleConnections > 4 ? (verticalEdges / totalPossibleConnections) * 100 : 0;
    setProgress(progressPercentage);
  };

  const showTooltip = (e) => {
    setTooltipVisible(true);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const hideTooltip = () => {
    setTooltipVisible(false);
  };


  useEffect(() => {
    console.log("Updated Connection Groups:", connectionGroups);
  }, [connectionGroups]);



  return (
    
    <div
      style={{
        textAlign: "center",
        position: "relative",
        fontFamily: "Arial, sans-serif",
      }}
      className="AppContainer"
    >
    <h1 className="title">
      <a href="https://mineyev.web.illinois.edu/ColorTaiko!/" target="_blank" style={{ textDecoration: "none" }}>
        <span style={{ color: '#e6194b', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>C</span>
        <span style={{ color: '#3cb44b', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>o</span>
        <span style={{ color: '#ffe119', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>l</span>
        <span style={{ color: '#f58231', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>o</span>
        <span style={{ color: '#dcbeff', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>r</span>
        <span style={{ color: '#9a6324', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>T</span>
        <span style={{ color: '#fabebe', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>a</span>
        <span style={{ color: '#7f00ff', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>i</span>
        <span style={{ color: '#f032e6', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>k</span>
        <span style={{ color: '#42d4f4', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>o</span>
        <span style={{ color: '#bfef45', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>!</span>
      </a>
    </h1>
      
      {/* Container for progress bar and text */}
<div style={{ marginTop: '-55px' }}> {/* Adjust this value as needed */}
  {/* Text above progress bar */}
  <p style={{
    color: 'white',
    fontSize: '14px',
    textAlign: 'left',
    marginBottom: '-5px',
    fontFamily: 'inherit',
  }}>
    Can you get to 100%?
  </p>

  <div
    className="progress-bar-container"
    onMouseEnter={showTooltip}
    onMouseMove={showTooltip}
    onMouseLeave={hideTooltip}
  >
    <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
      <span className="progress-bar-text">{Math.round(progress)}%</span>
    </div>
  </div>

  {/* Formula for progress bar */}
  <p style={{
    color: 'white',
    fontSize: '14px',
    textAlign: 'left',
    marginTop: '-7px',
    marginBottom: '-20px',
    fontFamily: 'inherit',
  }}>
    Progress = <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <span style={{ display: 'block', textAlign: 'center' }}>verticalEdges</span>
      <span style={{ display: 'block', borderTop: '1px solid white', paddingTop: '2px', textAlign: 'center' }}>
        (topRowCount - 1) × (bottomRowCount - 1) - (1 if odd, else 0)
      </span>
    </span>
    <span style={{ marginLeft: '5px' }}>× 100%</span>
  </p>
</div>

      {tooltipVisible && (
        <div
          className="tooltip"
          style={{ top: tooltipPosition.y + 10, left: tooltipPosition.x + 10 }}
        >
          <p>Vertical Edges: {connections.length}</p>
          <p>Top Nodes: {topRowCount - 1}</p>
          <p>Bottom Nodes: {bottomRowCount - 1}</p>
        </div>
      )}

      <button
        onClick={handleClear}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          padding: "10px 20px",
          fontSize: "16px",
          backgroundColor: "#f44336",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          fontFamily: "inherit", // This will use the font from the parent element
        }}
      >
        Clear
      </button>

      <ErrorModal className = "error-container" message={errorMessage} onClose={() => setErrorMessage("")} />

      {showNodes && (
        <div className="GameBox" style={{ position: "relative" }}>
          <div className="GameRow">{createTopRow(topRowCount)}</div>
          <svg
            ref={svgRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
          <div className="GameRow" style={{ marginTop: "100px" }}>
            {createBottomRow(bottomRowCount)}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
