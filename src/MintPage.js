import React from 'react';
import styled from "styled-components";
import Mint from './Mint';
import './styles/mint.css';

const MintPage = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="background">
      <div className="container">
        <img src="/config/images/logo-win.png" />
        <Mint />
      </div>
    </div>
  )
}

export default MintPage;