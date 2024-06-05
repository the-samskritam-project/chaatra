import './App.css';
import Dictionary from './Dictionary';
import Heading from './Heading';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

function App() {
  return (
    <div className="main-container">
      <Heading />

      <Tabs>       
        <TabList>
          <Tab>Dictionary</Tab>
          <Tab>Flash cards</Tab>
        </TabList>

        <TabPanel>
          <Dictionary />
        </TabPanel>

        <TabPanel>
          <div />
        </TabPanel>

      </Tabs>
    </div>
  );
}

export default App;
