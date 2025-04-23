import React from "react";

import './AboutUs.css';

// Image imports
import BradleyCohenImg from './assets/Bradley-Cohen.jpg';
import JacobImg from './assets/Jacob.jpg';
import TaniaImg from './assets/IMG_8297.jpg';
import BreannaImg from './assets/IMG_0775.jpg';
import RevelImg from './assets/RevelE_Headshot.jpg';
import KennethImg from './assets/IMG_8756.jpeg';
import DrewImg from './assets/IMG_0051.jpg';

const teamMembers = [
  {
    name: 'Revel Etheridge',
    img: RevelImg,
    linkedin: 'https://www.linkedin.com/in/revel-etheridge'
  },
  {
    name: 'Kenneth Adams',
    img: KennethImg,
    linkedin: 'https://www.linkedin.com/in/kenneth-adams-172930270/'
  },
  {
    name: 'Tania Perdomo Flores',
    img: TaniaImg,
    linkedin: 'https://www.linkedin.com/in/taniapflores'
  },
  {
    name: 'Jacob Sullivan',
    img: JacobImg,
    linkedin: 'https://www.linkedin.com/in/jacobtsullivan/'
  },
  {
    name: 'Breanna Woosley',
    img: BreannaImg,
    linkedin: 'https://www.linkedin.com/in/breanna-woosley-39a5ab220/'
  },
  {
    name: 'Drew Burkhalter',
    img: DrewImg,
    /*linkedin: 'https://www.linkedin.com/in/drew-burkhalter'*/
  },
];




export default function AboutUs() {
  return (
    <div className="bg-yellow-100 min-h-screen font-sans">
      <section className="px-6 py-10 text-center bg-white">
        <h2 className="text-4xl font-bold text-green-800 mb-4">About Us</h2>
        <div className="about-container">

        <img
          src={BradleyCohenImg}
          alt="Dr. Bradley Cohen"
          className="about-img"
        />
        <p className="about-text">
        Dr. Bradley S. Cohen serves as the lead researcher in the Biology Department at Tennessee Technological University, where his research focuses 
        on understanding how habitat management and landscape conditions influence wildlife populations.
        <p> 
    
        He is joined in his work by two research associates 
        and six graduate and undergraduate students, creating a collaborative research environment dedicated to advancing ecological knowledge. The lab 
        primarily specializes in ornithology, with an emphasis on studying bird populations and their interactions with their environments. 
        Over the years, they have published several impactful papers in the field, contributing valuable insights to wildlife management and conservation 
        strategies. 
        </p>
        Notable research projects undertaken by the lab include investigating Mallard habitat selection during the non-breeding season, assessing
        forage availability for wintering waterfowl, studying Wild Turkey reproductive ecology, and examining other aspects of avian biology. The team’s work 
        helps improve our understanding of how changes in habitat affect wildlife survival, reproduction, and migration, providing critical data for effective 
        conservation practices.
          <br /><br />
          To learn more about his research, check out the link: 
          <a href="https://www.cohenwildlifelab.com" 
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"> Dr. Cohen's Research Lab
          </a>
        </p>
      </div>
      </section>

      <section className="px-6 py-10 text-center bg-orange-50">
        <h2 className="text-3xl font-bold text-orange-800 mb-4">The Development Team</h2>
        <p className="max-w-4xl mx-auto text-lg mb-10">
          Our team of developers took on this project as part of their Software Engineering Capstone during their senior year(2025) at Tennessee Technological 
          University’s Computer Science program. The primary goal of this project was to give students the chance to work closely with real clients, gaining
          hands-on experience in a professional setting while receiving direct guidance from their professors. 
          <p></p> 
          Over the course of the project, they followed 
          agile methodologies, utilizing sprints, regular stand-ups, and iterative development to ensure continuous progress. This approach allowed them to 
          refine their technical skills, improve problem-solving abilities, and better understand how to meet client requirements. Additionally, they honed
          their teamwork and communication skills, collaborating effectively across different roles and learning to use various tools and resources—such as 
          version control, project management software, and cloud services—to bring the project to fruition. 
          <p></p>
          The experience has not only deepened their technical expertise but has also provided them with a strong foundation in professional practices, 
          preparing them for success in the software development industry. 
          <p></p>
          Working across design, full-stack development, and agile methodology, this group of students brought Moveduck to life.
        </p>

        <div className="team-grid">
          {teamMembers.map((member) => (
            <div key={member.name} className="team-member">
              <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="team-member-link">
              <img
                src={member.img}
                alt={member.name}
                className="team-member-img"
              />
              <p className="team-member-name">{member.name}</p>
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}